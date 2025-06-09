import { Request, Response } from "express";
import GitHubRepository from "../model/githubRepositories";
import GitHubIssues from "../model/githubIssues";
import { GitHubService } from "../services/githubService";

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

      // Update user's issue preferences
      await GitHubIssues.findOneAndUpdate(
        { userId, githubUsername },
        {
          $set: {
            "filters.languages": languages,
            "filters.labels": labels,
            "filters.difficulty": difficulty,
            "filters.minStars": minStars,
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
          res.status(200).json({
            success: true,
            message: "Issue details retrieved successfully",
            data: {
              issue,
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
}
