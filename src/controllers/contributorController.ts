import { Request, Response } from "express";
import GitHubRepository, { IRepository } from "../model/githubRepositories";
import GitHubIssues, { IIssue } from "../model/githubIssues";
import { GitHubService } from "../services/githubService";
import User from "../model/User";
import Stake from "../model/stake";

export class ContributorController {
  private githubService: GitHubService;

  constructor() {
    this.githubService = new GitHubService(process.env.GITHUB_TOKEN);
  }

  /**
   * Analyze user's GitHub repositories, organizations, and calculate language statistics
   */
  public analyzeUserRepositories = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId, githubUsername } = req.body;

      if (!userId || !githubUsername) {
        res.status(400).json({
          success: false,
          message: "User ID and GitHub username are required",
        });
        return;
      }

      // Check for recent analysis
      const existingAnalysis = await GitHubRepository.findOne({
        userId,
        githubUsername,
        lastAnalyzed: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (existingAnalysis) {
        res.status(200).json({
          success: true,
          message: "Repository analysis retrieved from cache",
          fromCache: true,
          data: {
            repositories: existingAnalysis.repositories,
            organizations: existingAnalysis.organizations,
            topLanguages: existingAnalysis.topLanguages,
            lastAnalyzed: existingAnalysis.lastAnalyzed,
          },
        });
        return;
      }

      // Fetch user repositories
      const repositories = await this.githubService.getUserRepositories(
        githubUsername
      );

      if (repositories.length === 0) {
        res.status(404).json({
          success: false,
          message: "No public repositories found",
        });
        return;
      }

      // Fetch user organizations
      const organizations = await this.githubService.getUserOrganizations(
        githubUsername
      );

      // Fetch language data for each repository
      const languagesData: Record<string, Record<string, number>> = {};

      for (const repo of repositories) {
        const [owner, repoName] = repo.fullName.split("/");
        try {
          languagesData[repo.fullName] =
            await this.githubService.getRepositoryLanguages(owner, repoName);
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          languagesData[repo.fullName] = {};
        }
      }

      // Calculate language statistics
      const { languageStats, topLanguages } =
        this.githubService.calculateLanguageStats(repositories, languagesData);

      // Save analysis with organizations
      const analysis = await GitHubRepository.findOneAndUpdate(
        { userId, githubUsername },
        {
          userId,
          githubUsername,
          repositories,
          organizations,
          languageStats,
          topLanguages,
          lastAnalyzed: new Date(),
        },
        { upsert: true, new: true }
      );

      res.status(200).json({
        success: true,
        message: "Repository analysis completed",
        data: {
          repositories: analysis.repositories,
          organizations: analysis.organizations,
          topLanguages: analysis.topLanguages,
          lastAnalyzed: analysis.lastAnalyzed,
          totalRepositories: repositories.length,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to analyze repositories",
        error: error.message,
      });
    }
  };

  /**
   * Get suggested issues based on user's top languages and organizations
   */
  public getSuggestedIssues = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId, githubUsername } = req.body;
      const { page = 1, perPage = 20 } = req.query;

      if (!userId || !githubUsername) {
        res.status(400).json({
          success: false,
          message: "User ID and GitHub username are required",
        });
        return;
      }

      // Get user's language analysis
      const userAnalysis = await GitHubRepository.findOne({
        userId,
        githubUsername,
      });

      if (!userAnalysis || userAnalysis.topLanguages.length === 0) {
        res.status(404).json({
          success: false,
          message: "No language analysis found",
        });
        return;
      }

      console.log("Top Languages:", userAnalysis.topLanguages);
      console.log("Organizations:", userAnalysis.organizations);

      // Fetch issues from GitHub based on languages and organizations
      const issues = await this.githubService.searchIssues(
        userAnalysis.topLanguages,
        userAnalysis.organizations,
        {
          page: Number(page),
          perPage: Number(perPage),
        }
      );

      // Enhance issues with bounty and XP data
      for (const issue of issues) {
        issue.bounty = this.calculateBounty(issue);
        issue.xpReward = this.calculateXPReward(issue);
      }

      res.status(200).json({
        success: true,
        message: "Suggested issues fetched",
        data: {
          issues,
          totalIssues: issues.length,
          userTopLanguages: userAnalysis.topLanguages,
          userOrganizations: userAnalysis.organizations,
          page: Number(page),
          perPage: Number(perPage),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch issues",
        error: error.message,
      });
    }
  };

  private calculateBounty(issue: IIssue): number {
    const baseBounty = 10;
    const difficultyMultiplier = {
      beginner: 1,
      intermediate: 1.5,
      advanced: 2,
    };

    return Math.round(
      baseBounty *
        difficultyMultiplier[issue.difficulty || "intermediate"] *
        (1 + issue.repository.stargazersCount / 1000)
    );
  }

  private calculateXPReward(issue: IIssue): number {
    return issue.difficulty === "beginner"
      ? 50
      : issue.difficulty === "intermediate"
      ? 100
      : 150;
  }

  /**
   * Get detailed information about a specific issue
   */
  public getIssueDetails = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { issueId } = req.params;
      const { userId, githubUsername } = req.body;

      if (!issueId) {
        res.status(400).json({ success: false, message: "Issue ID required" });
        return;
      }

      // Find issue in cached data
      const cachedIssues = await GitHubIssues.findOne({
        userId,
        githubUsername,
      });
      const issue = cachedIssues?.suggestedIssues.find(
        (i) => i.id.toString() === issueId
      );

      if (issue) {
        res.status(200).json({
          success: true,
          data: {
            issue,
            bounty: {
              coins: this.calculateBounty(issue),
              xp: this.calculateXPReward(issue),
              stakingRequired: Math.floor(this.calculateBounty(issue) * 0.3),
            },
          },
        });
        return;
      }

      res.status(404).json({ success: false, message: "Issue not found" });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to fetch issue details",
        error: error.message,
      });
    }
  };

  public getContributorProfile = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const user = await User.findById(userId);

      if (!user || user.role !== "contributor") {
        res
          .status(404)
          .json({ success: false, message: "Contributor not found" });
        return;
      }

      const stakes = await Stake.find({ userId })
        .sort({ createAt: -1 })
        .limit(5);

      res.status(200).json({
        success: true,
        data: {
          profile: {
            name: user.profile?.name,
            githubUsername: user.githubUsername,
          },
          stats: {
            coins: user.coins,
            xp: user.xp || 0,
            rank: user.rank,
          },
          recentStakes: stakes,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to get profile",
        error: error.message,
      });
    }
  };

  public prepareStake = async (req: Request, res: Response): Promise<void> => {
    try {
      const { issueId } = req.body;
      const issue = await GitHubIssues.findOne({
        "suggestedIssues.id": issueId,
      });

      if (!issue) {
        res.status(404).json({ success: false, message: "Issue not found" });
        return;
      }

      const issueDetails = issue.suggestedIssues.find((i) => i.id === issueId);
      const stakeAmount = issueDetails?.stakingRequired || 0;

      res.status(200).json({
        success: true,
        data: {
          stakeAmount,
          potentialReward: issueDetails?.bounty || 0,
          xpReward: issueDetails?.xpReward || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to prepare stake",
        error: error.message,
      });
    }
  };
}