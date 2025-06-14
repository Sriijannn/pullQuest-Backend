import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../model/User";

const router = Router();

// POST /register
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, githubUsername } = req.body;

  if (!role || !password) {
    res.status(400).json({ message: "Role and password are required" });
    return;
  }

  if (role === "company") {
    if (!email) {
      res.status(400).json({ message: "Email is required for company" });
      return;
    }
  } else {
    if (!githubUsername) {
      res.status(400).json({ message: "GitHub username is required for this role" });
      return;
    }
  }

  try {
    const existing = await User.findOne(
      role === "company"
        ? { email }
        : { githubUsername, role }
    );

    if (existing) {
      res.status(409).json({ message: "User already exists" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email: email || undefined,
      password: hashedPassword,
      role,
      githubUsername: githubUsername || undefined,
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
  const { email, password, role, githubUsername } = req.body;

  if (!role) {
    res.status(400).json({ message: "Role is required" });
    return;
  }

  try {
    let user;

    if (role === "company") {
      if (!email || !password) {
        res.status(400).json({ message: "Email and password required for company" });
        return;
      }

      user = await User.findOne({ email, role });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(401).json({ message: "Invalid credentials" });
        return;
      }
    } else {
      if (!githubUsername) {
        res.status(400).json({ message: "GitHub username is required for this role" });
        return;
      }

      user = await User.findOne({ githubUsername, role });
      if (!user) {
        res.status(401).json({ message: "Invalid GitHub credentials" });
        return;
      }
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
