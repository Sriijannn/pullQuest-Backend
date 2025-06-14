import User from "../model/User";
import { Request, Response, NextFunction } from "express";

export const getUserByEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {  // ✅ Add explicit return type
  const { email } = req.params;
  
  try {
    const user = await User.findOne({ email });
    
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return; // ✅ Add return to avoid hanging
    }

    res.json({
      id: user._id,
      email: user.email,
      role: user.role,
      githubUsername: user.githubUsername
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};