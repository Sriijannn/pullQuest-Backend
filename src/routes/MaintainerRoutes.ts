import { Router, RequestHandler } from "express";
import User from "../model/User";
import { listUserOrgs, listUserRepos, listRepoIssues } from "../controllers/MaintainerController";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();
router.use(verifyToken);

// GET /api/maintainer/orgs-by-username?githubUsername=theuser
const getOrgsByUsername: RequestHandler = async (req, res) => {
  try {
    console.log("---- Incoming request to /orgs-by-username ----");
    console.log("Query params:", req.query);
    console.log("-----------------------------------------------");

    const { githubUsername } = req.query as { githubUsername?: string };
    if (!githubUsername) {
      res.status(400).json({ success: false, message: "githubUsername is required" });
      return;
    }

    // Find user by githubUsername
    const mongoUser = await User.findOne({ githubUsername }).select("accessToken githubUsername");
    if (!mongoUser?.accessToken) {
      res.status(404).json({ success: false, message: "GitHub token not found for user" });
      return;
    }

    // Validate that githubUsername exists in the database record
    if (!mongoUser.githubUsername) {
      res.status(404).json({
        success: false,
        message: "GitHub username not found in user record"
      });
      return;
    }

    // Now TypeScript knows githubUsername is definitely a string
    const orgs = await listUserOrgs(mongoUser.githubUsername);
    res.status(200).json({ success: true, data: orgs });
  } catch (err: any) {
    console.error("Error fetching orgs:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// NEW: GET /api/maintainer/repos-by-username?githubUsername=theuser&per_page=30&page=1
const getReposByUsername: RequestHandler = async (req, res) => {
  try {
    console.log("---- Incoming request to /repos-by-username ----");
    console.log("Query params:", req.query);
    console.log("-----------------------------------------------");

    const { githubUsername, per_page = 30, page = 1 } = req.query as {
      githubUsername?: string;
      per_page?: string;
      page?: string;
    };
    if (!githubUsername) {
      res.status(400).json({ success: false, message: "githubUsername is required" });
      return;
    }

    // Fetch repos using your new utility
    const repos = await listUserRepos(githubUsername, Number(per_page), Number(page));
    res.status(200).json({ success: true, data: repos });
  } catch (err: any) {
    console.error("Error fetching repos:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getRepoIssues: RequestHandler = async (req, res) => {
    try {
      const { owner, repo, state = "open", per_page = 30, page = 1 } = req.query as {
        owner?: string;
        repo?: string;
        state?: "open" | "closed" | "all";
        per_page?: string;
        page?: string;
      };
      if (!owner || !repo) {
        res.status(400).json({ success: false, message: "owner and repo are required" });
        return;
      }
      const issues = await listRepoIssues(owner, repo, state, Number(per_page), Number(page));
      res.status(200).json({ success: true, data: issues });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };

router.get("/orgs-by-username", getOrgsByUsername);
router.get("/repos-by-username", getReposByUsername); // <-- Register your new route
router.get("/repo-issues", getRepoIssues);

export default router;
