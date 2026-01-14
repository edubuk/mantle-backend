// POST /api/auth/register
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { Otp } from "../models/otp.model";
import User from "../models/userCV.model";
import { sendOtpEmail } from "../utils/sendEmail";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { configDotenv } from "dotenv";

configDotenv();

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export const generateOtp =() => {
        
    const digits = "0123456789";
    const bytes = crypto.randomBytes(6);
    let otp = "";
    for (let i = 0; i < 6; i++) {
        otp += digits[bytes[i] % 10];
    }
    return otp;
}

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(409).json({ message: "User already exists" });

    // Generate OTP
    const otp = generateOtp();
    console.log("otp",otp);
    const otpHash = await bcrypt.hash(otp, 10);

    // Remove old OTP if exists
    await Otp.findOneAndDelete({ email });

    await Otp.create({
      email,
      otpHash,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 mins
    });

    await sendOtpEmail(email, otp);

    // Store password temporarily on frontend (NOT backend)
    res.status(200).json({
      message: "OTP sent to email",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


/**
 * LOGIN
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};



export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, otp, password } = req.body;

    const otpDoc = await Otp.findOne({ email });

    if (!otpDoc)
      return res.status(400).json({ message: "OTP not found" });

    if (otpDoc.used)
      return res.status(400).json({ message: "OTP already used" });

    if (otpDoc.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired" });

    const isValidOtp = await bcrypt.compare(otp, otpDoc.otpHash);
    if (!isValidOtp)
      return res.status(400).json({ message: "Invalid OTP" });

    // Create User
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: hashedPassword,
      isVerified: true,
    });

    otpDoc.used = true;
    await otpDoc.save();

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
    });
  } catch (error) {
    res.status(500).json({ message: "Registration failed. Server error", error });
  }
};

