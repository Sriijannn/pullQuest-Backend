import { Router } from "express";
import { ContributorController } from "../controllers/contributorController";
import { authMiddleware } from "../middleware/authMiddleware";
import { validateContributorRole } from "../middleware/roleMiddleware";

const router = Router();

const contributorController = new ContributorController();

router.use(authMiddleware)

router.use(validateContributorRole)

router.post('/analyze-repositories', contributorController.analyzeUserRepositories);

router.post('/suggested-issues', contributorController.getSuggestedIssues)

router.post('/repository-analysis/:userId/:githubUsername', contributorController.getRepositoryAnalysis)

router.post('/update-filters', contributorController.updateIssueFilters)

// router.post('/issue-details/:issueId', contributorController.getIssueDetails)

export default router
