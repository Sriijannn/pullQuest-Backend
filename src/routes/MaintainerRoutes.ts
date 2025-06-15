import { Router, RequestHandler } from "express";
import User from "../model/User";
import { listUserOrgs, listUserRepos, listRepoIssues, getIssueByNumber, listRepoPullRequests } from "../controllers/MaintainerController";
import { verifyToken } from "../middleware/verifyToken";
import { createRepoIssueAsUser } from "../controllers/MaintainerController";
import { ingestIssue } from "../controllers/IssueIngestController";
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

  export const createIssue: RequestHandler = async (req, res) => {
    try {
      const {
        owner,
        repo,
        title,
        body,
        labels,
        assignees,
        milestone,
      } = req.body as {
        owner: string;
        repo: string;
        title: string;
        body?: string;
        labels?: string[];
        assignees?: string[];
        milestone?: string | number;
      };
  
      // 1) Validate
      if (!owner || !repo || !title) {
        res
          .status(400)
          .json({ success: false, message: "owner, repo and title are required" });
        return;
      }
  
      // 2) Try user’s OAuth token
      let githubToken = (req.user as any)?.accessToken as string | undefined;
  
      // 3) Fallback to your service PAT from .env
      if (!githubToken) {
        githubToken = process.env.GITHUB_ISSUE_CREATION;
      }
  
      if (!githubToken) {
        res
          .status(403)
          .json({ success: false, message: "No GitHub token available to create issue" });
        return;
      }
  
      // 4) Create the issue
      const issue = await createRepoIssueAsUser(
        githubToken,
        owner,
        repo,
        title,
        body,
        labels,
        assignees,
        milestone
      );
  
      // 5) Return it
      res.status(201).json({ success: true, data: issue });
      return;
    } catch (err: any) {
      console.error("Error in createIssue handler:", err);
      res.status(500).json({ success: false, message: err.message });
      return;
    }
  };

  const getRepoPullRequests: RequestHandler = async (req, res) => {
    try {
      const { owner, repo, state = "open", per_page = "30", page = "1" } = req.query as {
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
  
      const pullRequests = await listRepoPullRequests(
        owner,
        repo,
        state,
        Number(per_page),
        Number(page)
      );
  
      res.status(200).json({ success: true, data: pullRequests });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  };


router.get("/orgs-by-username", getOrgsByUsername);
router.get("/repos-by-username", getReposByUsername); // <-- Register your new route
router.get("/repo-issues", getRepoIssues);
router.post("/create-issue", createIssue);
router.post("/ingest-issue", ingestIssue);
router.get("/repo-pulls", getRepoPullRequests);
router.get("/issue-by-number", getIssueByNumber);

export default router;
