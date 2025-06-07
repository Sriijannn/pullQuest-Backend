import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import { verifyToken } from "./middleware/verifyToken";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Middleware to skip verifyToken on /login and /register
const jwtMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Allow unauthenticated access to these paths
  if (req.path === "/login" || req.path === "/register") {
    next();
    return;
  }
  // Otherwise verify token
  verifyToken(req, res, next);
};

// Apply the middleware and then routes
app.use("/api", jwtMiddleware, authRoutes);

// Optional health check route (no auth needed)
app.get("/health", verifyToken, (req: Request, res: Response): void => {
  res.json({ status: "Server is running" });
});

mongoose
  .connect(process.env.MONGO_URI!)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
  });
