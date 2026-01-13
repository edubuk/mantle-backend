// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ message: "No token provided" });

  try {
    const match = jwt.verify(token, JWT_SECRET);
    if(!match)
        return res.status(401).json({ message: "Invalid token" });
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
