import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import session from "express-session";
import authRoutes from "./routes/auth";
import githubRoutes from "./routes/github";
import { verifyToken } from "./middleware/verifyToken";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Configure CORS to allow credentials from your frontend
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

// Setup sessions for OAuth login tracking
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change_this_secret",
    resave: false,
    saveUninitialized: false,
  })
);

// Parse JSON bodies
app.use(express.json());

// Mount GitHub OAuth routes (no JWT required)
app.use(githubRoutes);

// Middleware to skip verifyToken on login and register
const jwtMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.path === "/login" || req.path === "/register") {
    next();
    return;
  }
  verifyToken(req, res, next);
};

// Mount protected auth routes under /api
app.use("/api", jwtMiddleware, authRoutes);

// Health check (protected)
app.get("/health", verifyToken, (req: Request, res: Response): void => {
  res.json({ status: "Server is running" });
});

// MongoDB connection
const uri = process.env.MONGO_URI;
if (!uri) throw new Error("MONGO_URI must be set in .env");

mongoose
  .connect(uri)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
  });
