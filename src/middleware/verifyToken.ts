import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: any;
}

export const verifyToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Add explicit return type
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];

  if (!token) {
    res.status(403).json({ message: "No token provided" });
    return; // Return void, not the response
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = decoded;
    console.log("Authenticated user:", decoded);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
    return; // Return void, not the response
  }
};
