import axios, { AxiosResponse } from "axios";
import { IRepository, ILanguageStats } from "../model/githubRepositories";
import { IIssue } from "../model/githubIssues";

export interface IOrganization {
  id: number;
  login: string;
  name: string | null;
  description: string | null;
  htmlUrl: string;
  url: string;
  reposUrl: string;
  eventsUrl: string;
  membersUrl: string;
  publicMembersUrl: string;
  avatarUrl: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class GitHubService {
  private readonly baseURL = "https://api.github.com";
  private readonly token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private getHeaders() {
    const headers: any = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Fetch user's public repositories

  async getUserRepositories(
    username: string,
    page: number = 1,
    perPage: number = 100
  ): Promise<IRepository[]> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/users/${username}/repos`,
        {
          headers: this.getHeaders(),
          params: {
            type: "public",
            sort: "updated",
            direction: "desc",
            page,
            per_page: perPage,
          },
        }
      );

      return response.data.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
        description: repo.description,
        language: repo.language,
        stargazersCount: repo.stargazers_count,
        forksCount: repo.forks_count,
        size: repo.size,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at),
        topics: repo.topics || [],
        visibility: repo.visibility,
      }));
    } catch (error: any) {
      console.error(
        "Error fetching user repositories:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to fetch repositories: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  // Get repository languages with bytes information

  async getRepositoryLanguages(
    owner: string,
    repo: string
  ): Promise<Record<string, number>> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}/languages`,
        {
          headers: this.getHeaders(),
        }
      );

      return response.data;
    } catch (error: any) {
      console.error(
        `Error fetching languages for ${owner}/${repo}:`,
        error.response?.data || error.message
      );
      return {};
    }
  }

  // Calculate language statistics from repositories

  calculateLanguageStats(
    repositories: IRepository[],
    languagesData: Record<string, Record<string, number>>
  ): {
    languageStats: Map<string, ILanguageStats>;
    topLanguages: string[];
  } {
    const languageMap = new Map<
      string,
      { count: number; totalBytes: number }
    >();

    // Process each repository's languages
    repositories.forEach((repo) => {
      const repoLanguages = languagesData[repo.fullName] || {};

      Object.entries(repoLanguages).forEach(([language, bytes]) => {
        if (languageMap.has(language)) {
          const existing = languageMap.get(language)!;
          existing.count += 1;
          existing.totalBytes += bytes;
        } else {
          languageMap.set(language, { count: 1, totalBytes: bytes });
        }
      });
    });

    // Calculate total bytes across all languages
    const totalBytes = Array.from(languageMap.values()).reduce(
      (sum, lang) => sum + lang.totalBytes,
      0
    );

    // Create language stats with percentages
    const languageStats = new Map<string, ILanguageStats>();
    languageMap.forEach((data, language) => {
      languageStats.set(language, {
        count: data.count,
        percentage: totalBytes > 0 ? (data.totalBytes / totalBytes) * 100 : 0,
        totalBytes: data.totalBytes,
      });
    });

    // Get top languages (sorted by total bytes)
    const topLanguages = Array.from(languageStats.entries())
      .sort((a, b) => b[1].totalBytes - a[1].totalBytes)
      .slice(0, 5)
      .map(([language]) => language);

    return { languageStats, topLanguages };
  }

  async searchIssues(
    languages: string[],
    organizations: string[],
    options: {
      page?: number;
      perPage?: number;
    } = {}
  ): Promise<IIssue[]> {
    try {
      const { page = 1, perPage = 50 } = options;

      // Build search query
      let queryParts: string[] = ["state:open", "type:issue"];

      // Add language filters
      if (languages.length > 0) {
        const langQuery = languages
          .slice(0, 5) // Limit to 5 languages
          .map((lang) => `language:"${lang}"`)
          .join(" OR ");
        queryParts.push(`(${langQuery})`);
      }

      if (organizations.length > 0) {
        const orgQuery = organizations
          .slice(0, 5) // Limit to 5 organizations
          .map((org) => `org:"${org}"`)
          .join(" OR ");
        queryParts.push(`(${orgQuery})`);
      }

      // Add default labels
      queryParts.push(
        `label:"good first issue" OR label:"help wanted" OR label:"beginner-friendly"`
      );

      const query = queryParts.join(" ");
      console.log("GitHub Search Query:", query);

      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/search/issues`,
        {
          headers: this.getHeaders(),
          params: {
            q: query,
            sort: "updated",
            order: "desc",
            page,
            per_page: perPage,
          },
        }
      );

      return response.data.items.map((issue: any) => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        htmlUrl: issue.html_url,
        user: {
          id: issue.user.id,
          login: issue.user.login,
          avatarUrl: issue.user.avatar_url,
          htmlUrl: issue.user.html_url,
          type: issue.user.type,
        },
        labels:
          issue.labels?.map((label: any) => ({
            id: label.id,
            name: label.name,
            color: label.color,
            description: label.description,
          })) || [],
        assignee: issue.assignee
          ? {
              id: issue.assignee.id,
              login: issue.assignee.login,
              avatarUrl: issue.assignee.avatar_url,
              htmlUrl: issue.assignee.html_url,
              type: issue.assignee.type,
            }
          : undefined,
        assignees:
          issue.assignees?.map((assignee: any) => ({
            id: assignee.id,
            login: assignee.login,
            avatarUrl: assignee.avatar_url,
            htmlUrl: assignee.html_url,
            type: assignee.type,
          })) || [],
        milestone: issue.milestone
          ? {
              id: issue.milestone.id,
              title: issue.milestone.title,
              description: issue.milestone.description,
              state: issue.milestone.state,
              dueOn: issue.milestone.due_on
                ? new Date(issue.milestone.due_on)
                : undefined,
            }
          : undefined,
        commentsCount: issue.comments,
        createdAt: new Date(issue.created_at),
        updatedAt: new Date(issue.updated_at),
        closedAt: issue.closed_at ? new Date(issue.closed_at) : undefined,
        authorAssociation: issue.author_association,
        repository: {
          id: issue.repository_url.split("/").pop(),
          name: issue.repository_url.split("/").pop(),
          fullName: `${issue.repository_url.split("/").slice(-2).join("/")}`,
          htmlUrl: issue.html_url.split("/issues/")[0],
          language: undefined, // Will be filled later if needed
          stargazersCount: 0, // Will be filled later if needed
          forksCount: 0, // Will be filled later if needed
          description: undefined, // Will be filled later if needed
        },
        difficulty: this.estimateDifficulty(issue),
        estimatedHours: this.estimateHours(issue),
        bounty: this.calculateBounty(issue),
        xpReward: this.calculateXPReward(issue),
        stakingRequired: Math.floor(this.calculateBounty(issue) * 0.3),
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      }));
    } catch (error: any) {
      console.error(
        "Error searching issues:",
        error.response?.data || error.message
      );
      throw new Error(
        `Failed to search issues: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  }

  private calculateBounty(issue: any): number {
    const base = 10;
    const difficulty = this.estimateDifficulty(issue);
    const multiplier =
      difficulty === "beginner" ? 1 : difficulty === "intermediate" ? 1.5 : 2;
    return Math.round(base * multiplier);
  }

  private calculateXPReward(issue: any): number {
    return issue.difficulty === "beginner"
      ? 50
      : issue.difficulty === "intermediate"
      ? 100
      : 150;
  }

  // Get detailed repository information

  async getRepositoryDetails(owner: string, repo: string): Promise<any> {
    try {
      const response: AxiosResponse = await axios.get(
        `${this.baseURL}/repos/${owner}/${repo}`,
        {
          headers: this.getHeaders(),
        }
      );

      return {
        id: response.data.id,
        name: response.data.name,
        fullName: response.data.full_name,
        htmlUrl: response.data.html_url,
        description: response.data.description,
        language: response.data.language,
        stargazersCount: response.data.stargazers_count,
        forksCount: response.data.forks_count,
      };
    } catch (error: any) {
      console.error(
        `Error fetching repository details for ${owner}/${repo}:`,
        error.response?.data || error.message
      );
      return null;
    }
  }

  // Estimate issue difficulty based on labels and content
  private estimateDifficulty(
    issue: any
  ): "beginner" | "intermediate" | "advanced" {
    const beginnerLabels = [
      "good first issue",
      "beginner",
      "easy",
      "starter",
      "beginner-friendly",
    ];
    const advancedLabels = ["complex", "advanced", "hard", "expert"];

    const labels =
      issue.labels?.map((label: any) => label.name.toLowerCase()) || [];

    if (
      labels.some((label: string) =>
        beginnerLabels.some((bl) => label.includes(bl))
      )
    ) {
      return "beginner";
    }

    if (
      labels.some((label: string) =>
        advancedLabels.some((al) => label.includes(al))
      )
    ) {
      return "advanced";
    }

    return "intermediate";
  }

  /**
   * Estimate hours needed based on issue complexity
   */
  private estimateHours(issue: any): number {
    const bodyLength = issue.body?.length || 0;
    const commentsCount = issue.comments || 0;
    const labelsCount = issue.labels?.length || 0;

    // Simple heuristic based on content complexity
    if (bodyLength < 200 && commentsCount < 5) {
      return Math.random() * 3 + 1; // 1-4 hours
    } else if (bodyLength < 500 && commentsCount < 15) {
      return Math.random() * 8 + 4; // 4-12 hours
    } else {
      return Math.random() * 20 + 12; // 12-32 hours
    }
  }

  public async getUserOrganizations(username: string): Promise<string[]> {
    const orgService = new GitHubOrganizationsService(this.token);
    const orgs = await orgService.getUserOrganizations(username);
    return orgs.map((org) => org.login);
  }
}

// services/githubService.ts
export class GitHubOrganizationsService {
  private readonly baseURL = "https://api.github.com";
  private readonly token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * If `username` is provided: hits /users/:username/orgs
   * Otherwise: hits /user/orgs (authenticated user via your token)
   */
  async getUserOrganizations(
    username?: string,
    page = 1,
    perPage = 100
  ): Promise<IOrganization[]> {
    const endpoint = username
      ? `${this.baseURL}/users/${username}/orgs`
      : `${this.baseURL}/user/orgs`;

    const response: AxiosResponse = await axios.get(endpoint, {
      headers: this.getHeaders(),
      params: { page, per_page: perPage },
    });

    return response.data.map((org: any) => ({
      id: org.id,
      login: org.login,
      name: org.name,
      description: org.description,
      htmlUrl: org.html_url,
      url: org.url,
      reposUrl: org.repos_url,
      eventsUrl: org.events_url,
      membersUrl: org.members_url,
      publicMembersUrl: org.public_members_url,
      avatarUrl: org.avatar_url,
      isVerified: org.is_verified || false,
      createdAt: new Date(org.created_at),
      updatedAt: new Date(org.updated_at),
    }));
  }
}
