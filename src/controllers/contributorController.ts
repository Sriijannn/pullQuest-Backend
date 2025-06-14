import { Request, Response } from "express";
import GitHubRepository, { IRepository } from "../model/githubRepositories";
import GitHubIssues, { IIssue } from "../model/githubIssues";
import { GitHubService } from "../services/githubService";
import User from "../model/User";
import Stake from "../model/stake";
import githubIssues from "../model/githubIssues";

export class ContributorController {
  private githubService: GitHubService;

  constructor() {
    this.githubService = new GitHubService(process.env.GITHUB_TOKEN);
  }

  /**
   * Analyze user's GitHub repositories and calculate language statistics
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

      // Check if analysis already exists and is recent (less than 24 hours old)
      const existingAnalysis = await GitHubRepository.findOne({
        userId,
        githubUsername,
        lastAnalyzed: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (existingAnalysis) {
        res.status(200).json({
          success: true,
          message: "Repository analysis retrieved from cache",
          userId,
          githubUsername,
          fromCache: true,
          data: {
            repositories: existingAnalysis.repositories,
            languageStats: Object.fromEntries(existingAnalysis.languageStats),
            topLanguages: existingAnalysis.topLanguages,
            lastAnalyzed: existingAnalysis.lastAnalyzed,
          },
        });
        return;
      }

      // Fetch user repositories from GitHub
      console.log(`Fetching repositories for user: ${githubUsername}`);
      const repositories = await this.githubService.getUserRepositories(
        githubUsername
      );

      if (repositories.length === 0) {
        res.status(404).json({
          success: false,
          message: "No public repositories found for this user",
        });
        return;
      }

      // Fetch language data for each repository
      console.log(
        `Fetching language data for ${repositories.length} repositories`
      );
      const languagesData: Record<string, Record<string, number>> = {};

      for (const repo of repositories) {
        const [owner, repoName] = repo.fullName.split("/");
        try {
          const languages = await this.githubService.getRepositoryLanguages(
            owner,
            repoName
          );
          languagesData[repo.fullName] = languages;

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(
            `Failed to fetch languages for ${repo.fullName}:`,
            error
          );
          languagesData[repo.fullName] = {};
        }
      }

      // Calculate language statistics
      const { languageStats, topLanguages } =
        this.githubService.calculateLanguageStats(repositories, languagesData);

      // Save or update the analysis
      const analysis = await GitHubRepository.findOneAndUpdate(
        { userId, githubUsername },
        {
          userId,
          githubUsername,
          repositories,
          languageStats,
          topLanguages,
          lastAnalyzed: new Date(),
        },
        { upsert: true, new: true }
      );

      res.status(200).json({
        success: true,
        message: "Repository analysis completed successfully",
        data: {
          repositories: analysis.repositories,
          languageStats: Object.fromEntries(analysis.languageStats),
          topLanguages: analysis.topLanguages,
          lastAnalyzed: analysis.lastAnalyzed,
          totalRepositories: repositories.length,
          coinRewards: this.calculateCoinRewards(repositories),
        },
      });
    } catch (error: any) {
      console.error("Error analyzing user repositories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to analyze repositories",
        error: error.message,
      });
    }
  };

  private calculateCoinRewards(repositories: IRepository[]): number {
    return repositories.reduce((total, repo) => {
      return total + repo.stargazersCount * 0.5 + repo.forksCount * 0.2;
    }, 0);
  }

  /**
   * Get suggested issues based on user's top languages
   */
  public getSuggestedIssues = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId, githubUsername } = req.body;
      const {
        refreshCache = false,
        labels,
        minStars = 10,
        difficulty,
        page = 1,
        perPage = 20,
      } = req.query;

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
          message:
            "No language analysis found. Please analyze repositories first.",
        });
        return;
      }

      // Check for cached issues (less than 4 hours old) unless refresh is requested
      if (!refreshCache) {
        const cachedIssues = await GitHubIssues.findOne({
          userId,
          githubUsername,
          lastFetched: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        });

        if (cachedIssues) {
          // Apply filters to cached issues
          let filteredIssues = cachedIssues.suggestedIssues;

          if (difficulty) {
            filteredIssues = filteredIssues.filter(
              (issue) => issue.difficulty === difficulty
            );
          }

          if (labels) {
            const labelArray = Array.isArray(labels) ? labels : [labels];
            filteredIssues = filteredIssues.filter((issue) =>
              issue.labels.some((label) =>
                labelArray.some((filterLabel) =>
                  label.name
                    .toLowerCase()
                    .includes(filterLabel.toString().toLowerCase())
                )
              )
            );
          }

          // Pagination
          const startIndex = (Number(page) - 1) * Number(perPage);
          const paginatedIssues = filteredIssues.slice(
            startIndex,
            startIndex + Number(perPage)
          );

          res.status(200).json({
            success: true,
            message: "Suggested issues retrieved from cache",
            data: {
              issues: paginatedIssues,
              totalIssues: filteredIssues.length,
              userTopLanguages: cachedIssues.userTopLanguages,
              lastFetched: cachedIssues.lastFetched,
              page: Number(page),
              perPage: Number(perPage),
              totalPages: Math.ceil(filteredIssues.length / Number(perPage)),
            },
          });
          return;
        }
      }

      // Fetch fresh issues from GitHub
      console.log(
        `Fetching issues for languages: ${userAnalysis.topLanguages.join(", ")}`
      );

      const searchOptions = {
        labels: labels
          ? Array.isArray(labels)
            ? (labels as string[])
            : [labels as string]
          : undefined,
        minStars: Number(minStars),
        page: Number(page),
        perPage: Number(perPage),
      };

      const issues = await this.githubService.searchIssues(
        userAnalysis.topLanguages,
        searchOptions
      );

      // Enhance issues with repository details
      console.log(`Enhancing ${issues.length} issues with repository details`);
      for (const issue of issues) {
        try {
          const [owner, repo] = issue.repository.fullName.split("/");
          const repoDetails = await this.githubService.getRepositoryDetails(
            owner,
            repo
          );

          issue.bounty = this.calculateBounty(issue);
          issue.xpReward = this.calculateXPReward(issue);

          if (repoDetails) {
            issue.repository = { ...issue.repository, ...repoDetails };
          }

          // Add a small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.warn(
            `Failed to fetch repository details for ${issue.repository.fullName}:`,
            error
          );
        }
      }

      // Apply difficulty filter if specified
      let filteredIssues = issues;
      if (difficulty) {
        filteredIssues = issues.filter(
          (issue) => issue.difficulty === difficulty
        );
      }

      // Save or update the suggested issues
      await GitHubIssues.findOneAndUpdate(
        { userId, githubUsername },
        {
          userId,
          githubUsername,
          suggestedIssues: issues,
          userTopLanguages: userAnalysis.topLanguages,
          lastFetched: new Date(),
          filters: {
            languages: userAnalysis.topLanguages,
            labels: searchOptions.labels || [],
            difficulty: difficulty as string,
            minStars: Number(minStars),
          },
        },
        { upsert: true, new: true }
      );

      res.status(200).json({
        success: true,
        message: "Suggested issues fetched successfully",
        data: {
          issues: filteredIssues,
          totalIssues: filteredIssues.length,
          userTopLanguages: userAnalysis.topLanguages,
          lastFetched: new Date(),
          page: Number(page),
          perPage: Number(perPage),
          totalPages: Math.ceil(filteredIssues.length / Number(perPage)),
          searchCriteria: {
            languages: userAnalysis.topLanguages,
            minStars: Number(minStars),
            labels: searchOptions.labels,
            difficulty,
          },
        },
      });
    } catch (error: any) {
      console.error("Error fetching suggested issues:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch suggested issues",
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
   * Get user's repository analysis summary
   */
  public getRepositoryAnalysis = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId, githubUsername } = req.params;

      const analysis = await GitHubRepository.findOne({
        userId,
        githubUsername,
      });

      if (!analysis) {
        res.status(404).json({
          success: false,
          message: "No repository analysis found for this user",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Repository analysis retrieved successfully",
        data: {
          githubUsername: analysis.githubUsername,
          totalRepositories: analysis.repositories.length,
          languageStats: Object.fromEntries(analysis.languageStats),
          topLanguages: analysis.topLanguages,
          lastAnalyzed: analysis.lastAnalyzed,
          repositoryBreakdown: {
            byLanguage: analysis.topLanguages.map((lang) => ({
              language: lang,
              count: analysis.repositories.filter(
                (repo) => repo.language === lang
              ).length,
              totalStars: analysis.repositories
                .filter((repo) => repo.language === lang)
                .reduce((sum, repo) => sum + repo.stargazersCount, 0),
            })),
            totalStars: analysis.repositories.reduce(
              (sum, repo) => sum + repo.stargazersCount,
              0
            ),
            totalForks: analysis.repositories.reduce(
              (sum, repo) => sum + repo.forksCount,
              0
            ),
            mostStarredRepo: analysis.repositories.reduce((max, repo) =>
              repo.stargazersCount > max.stargazersCount ? repo : max
            ),
          },
        },
      });
    } catch (error: any) {
      console.error("Error retrieving repository analysis:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve repository analysis",
        error: error.message,
      });
    }
  };

  /**
   * Update issue filters and get filtered results
   */
  public updateIssueFilters = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { userId, githubUsername } = req.body;
      const { languages, labels, difficulty, minStars } =
        req.body.filters || {};

      if (!userId || !githubUsername) {
        res.status(400).json({
          success: false,
          message: "User ID and GitHub username are required",
        });
        return;
      }

      const { minBounty, maxBounty } = req.body.filters || {};

      // Update user's issue preferences
      await GitHubIssues.findOneAndUpdate(
        { userId, githubUsername },
        {
          $set: {
            "filters.languages": languages,
            "filters.labels": labels,
            "filters.difficulty": difficulty,
            "filters.minStars": minStars,
            "filters.minBounty": minBounty,
            "filters.maxBounty": maxBounty,
          },
        },
        { upsert: true }
      );

      res.status(200).json({
        success: true,
        message: "Issue filters updated successfully",
        data: {
          appliedFilters: {
            languages,
            labels,
            difficulty,
            minStars,
          },
        },
      });
    } catch (error: any) {
      console.error("Error updating issue filters:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update issue filter",
        error: error.message,
      });
    }
  };

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
        res.status(400).json({
          success: false,
          message: "Issue ID is required",
        });
        return;
      }

      // First, try to find the issue in our cached data
      const cachedIssues = await GitHubIssues.findOne({
        userId,
        githubUsername,
      });

      if (cachedIssues) {
        const issue = cachedIssues.suggestedIssues.find(
          (issue) => issue.id.toString() === issueId
        );

        if (issue) {
          const bountyDetails = {
            coins: this.calculateBounty(issue),
            xp: this.calculateXPReward(issue),
            expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            stakingRequired: Math.floor(this.calculateBounty(issue) * 0.3),
          };

          res.status(200).json({
            success: true,
            message: "Issue details retrieved successfully",
            data: {
              issue,
              bounty: bountyDetails,
              fromCache: true,
            },
          });
          return;
        }
      }

      // If not found in cache, try to fetch from GitHub API
      // This would require parsing the issue URL or having additional context
      res.status(404).json({
        success: false,
        message: "Issue not found in cached data",
      });
    } catch (error: any) {
      console.error("Error fetching issue details:", error);
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
        res.status(404).json({
          success: false,
          message: "Contributor not found",
        });
        return;
      }

      const nextRankXP = user.xpForNextRank ? user.xpForNextRank() : 0;
      const stakes = await Stake.find({ userId })
        .sort({ createAt: -1 })
        .limit(5);

      res.status(200).json({
        success: true,
        data: {
          profile: {
            name: user.profile?.name,
            githubUsername: user.githubUsername,
            bio: user.profile?.bio,
          },
          stats: {
            coins: user.coins,
            xp: user.xp || 0,
            rank: user.rank,
            nextRankXP,
            monthlyRefillDate: user.monthlyCoinsLastRefill,
          },
          recentStakes: stakes,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to get contributor profile",
        error: error.message,
      });
    }
  };

  public prepareStake = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId, issueId } = req.body;
      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const issue = await githubIssues.findOne({
        "suggestedIssues.id": issueId,
      });
      if (!issue) {
        res.status(404).json({
          success: false,
          message: "Issue not found",
        });
      }

      const issueDetails = issue?.suggestedIssues.find((i) => i.id === issueId);
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
