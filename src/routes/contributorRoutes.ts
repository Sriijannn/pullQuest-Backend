import { Router } from "express";
import { ContributorController } from "../controllers/contributorController";
import { authMiddleware } from "../middleware/authMiddleware";
import { validateContributorRole } from "../middleware/roleMiddleware";
import {
  repositoryAnalysisRateLimit,
  issueFetchRateLimit,
} from "../middleware/rateLimitMiddleware";

const router = Router();

const contributorController = new ContributorController();

router.use(authMiddleware);
router.use(validateContributorRole);

router.post(
  "/analyze-repositories",
  repositoryAnalysisRateLimit,
  contributorController.analyzeUserRepositories
);

router.post(
  "/suggested-issues",
  issueFetchRateLimit,
  contributorController.getSuggestedIssues
);

router.get(
  "/repository-analysis/:userId/:githubUsername",
  contributorController.getRepositoryAnalysis
);

router.post("/update-filters", contributorController.updateIssueFilters);

router.get("/issue-details/:issueId", contributorController.getIssueDetails);

export default router;
