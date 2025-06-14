import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth";
import { verifyToken } from "./middleware/verifyToken";
import helmet from "helmet";
import { handlePRWebhook } from "./webhooks/githubWebhooks";
import session from "express-session";
import passport from "passport";
import "./auth/github";
import contributorRoutes from "./routes/contributorRoutes";
import maintainerRoutes from "./routes/MaintainerRoutes";
import { githubApiRateLimit } from "./middleware/rateLimitMiddleware";
import User from "./model/User";
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(
  session({
    secret: "pullquestby4anus",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

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

// Start GitHub OAuth flow
app.get(
  "/auth/github",
  passport.authenticate("github", { scope: ["user:email"] })
);


// GitHub OAuth callback
app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    const user = req.user as {
      profile: any;
      accessToken: string;
      refreshToken: string | null;
    };

    // ─── Persist into MongoDB ─────────────────────────────────────────
    const { profile, accessToken, refreshToken } = user;
    const githubUsername = profile.username;
    const githubInfo    = JSON.stringify(profile._json);

    User.findOneAndUpdate(
      { githubUsername },
      {
        $set: {
          accessToken,
          refreshToken,
          githubInfo,
          lastLogin: new Date(),
        },
      },
      { upsert: true, new: true }
    ).then(dbUser => {
        console.log("✅ Saved GitHub user to DB with _id:", dbUser._id);
    }).catch(err => {
        console.error("❌ Error saving GitHub user to DB:", err);
    });
    // ─────────────────────────────────────────────────────────────────

    console.log("✅ GitHub OAuth success:");
    console.log("Full user object →", JSON.stringify(user, null, 2));
    console.log("accessToken →", user.accessToken);
    console.log("refreshToken →", user.refreshToken);
    res.redirect(`http://localhost:5173?user=${JSON.stringify(req.user)}`);
  }
);

app.get("/api/user", (req, res) => {
  res.json(req.user || null);
});

app.use("/api", githubApiRateLimit);

app.get("/health", (req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

app.post(
  "/webhooks/github",
  express.json({
    type: "application/json",
  }),
  handlePRWebhook
);

app.use("/", authRoutes);

app.use("/api/contributor", contributorRoutes);
app.use("/api/maintainer", maintainerRoutes);
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

    import("./utils/coinRefillScheduler").then((module) => {
      module.scheduleCoinRefill();
    });

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