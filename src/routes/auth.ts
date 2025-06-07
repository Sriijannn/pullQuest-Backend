import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../model/User";

const router = Router();

// POST /register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    res.status(400).json({ message: "All fields are required" });
    return;
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      res.status(409).json({ message: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /login
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const { email, password, role } = req.body;

  try {
    const user = await User.findOne({ email, role });
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

export default router;
