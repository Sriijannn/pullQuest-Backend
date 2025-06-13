import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import session from "express-session";
import helmet from "helmet";

// Route imports
import authRoutes from "./routes/auth";
import githubRoutes from "./routes/GithubRoutes";
import contributorRoutes from "./routes/contributorRoutes";
import { githubApiRateLimit } from "./middleware/rateLimitMiddleware";
import { verifyToken } from "./middleware/verifyToken";

dotenv.config();
const app: Application = express();
const PORT = process.env.PORT || 5000;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// ————————————————
// **SESSION MUST COME BEFORE GITHUB ROUTES**
app.use(
  session({
    secret: process.env.GITHUB_CLIENT_SECRET!,  // <-- your session secret from .env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // set true if HTTPS
  })
);

// Mount GitHub OAuth & org routes at the root or under /api
app.use("/", githubRoutes);               // handles /auth/github and /auth/callback/github
app.use("/api/github", githubApiRateLimit, githubRoutes);
// JWT middleware for your own auth routes
app.use((req, res, next) => {
  if (req.path === "/login" || req.path === "/register") return next();
  return verifyToken(req, res, next);
});

// Your own auth, contributor, etc.
app.use("/", authRoutes);
app.use("/api/contributor", contributorRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ success: true, message: "Server is running" });
});

// MongoDB connection
const uri = process.env.MONGO_URI;
if (!uri) throw new Error("MONGO_URI must be set in .env");

//db connection function
const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI;
    if (!mongoURI) {
      throw new Error("MONGO_URI not found in environment variables");
    }

    await mongoose.connect(mongoURI);
    console.log("✅ MongoDB connected successfully");
  } catch (error: any) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// Start server
const startServer = async (): Promise<void> => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error: any) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
