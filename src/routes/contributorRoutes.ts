import { Router } from "express";
import { ContributorController } from "../controllers/contributorController";
import {
  repositoryAnalysisRateLimit,
  issueFetchRateLimit,
} from "../middleware/rateLimitMiddleware";
import { StakeController } from "../controllers/stakeController";

const router = Router();

const contributorController = new ContributorController();

const stakeController = new StakeController();

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

router.get("/issue-details/:issueId", contributorController.getIssueDetails);

router.post("/stakes", stakeController.createStake);
router.patch("/stakes/:stakesId", stakeController.updateStakeStatus);
router.get("/:userId/stakes", stakeController.getUserStakes);
router.get("/profile/:userId", contributorController.getContributorProfile);
router.post("prepare-stakes", contributorController.prepareStake);

export default router;