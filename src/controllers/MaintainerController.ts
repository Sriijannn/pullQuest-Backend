// src/utils/github.ts
import { Octokit } from "@octokit/core";

export async function listUserOrgs(
  username: string,
  perPage: number = 30,
  page: number = 1
): Promise<any[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN not configured in environment");
  }

  if (!username) {
    throw new Error("GitHub username is required");
  }

  const octokit = new Octokit({
    auth: token,
    userAgent: "PullQuest-Backend v1.0.0",
  });

  try {
    const { data } = await octokit.request('GET /users/{username}/orgs', {
      username: username,
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      per_page: perPage,
      page,
    });

    return data;
  } catch (error: any) {
    console.error("GitHub API Error:", error);
    
    // Handle specific GitHub API errors
    if (error.status === 401) {
      throw new Error("Invalid GitHub token in environment");
    }
    if (error.status === 403) {
      throw new Error("GitHub API rate limit exceeded or insufficient permissions");
    }
    if (error.status === 404) {
      throw new Error("User not found or organizations are private");
    }
    if (error.status === 422) {
      throw new Error("Invalid username");
    }
    if (error.status >= 500) {
      throw new Error("GitHub API server error. Please try again later");
    }
    
    throw new Error(`GitHub API error: ${error.message || 'Unknown error'}`);
  }
}

export async function listUserRepos(
    username: string,
    perPage: number = 30,
    page: number = 1
  ): Promise<any[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN not configured in environment");
    }
    if (!username) {
      throw new Error("GitHub username is required");
    }
  
    const octokit = new Octokit({
      auth: token,
      userAgent: "PullQuest-Backend v1.0.0",
    });
  
    try {
      const { data } = await octokit.request('GET /users/{username}/repos', {
        username,
        per_page: perPage,
        page,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        }
      });
      return data;
    } catch (error: any) {
      console.error("GitHub API Error:", error);
  
      if (error.status === 401) {
        throw new Error("Invalid GitHub token in environment");
      }
      if (error.status === 403) {
        throw new Error("GitHub API rate limit exceeded or insufficient permissions");
      }
      if (error.status === 404) {
        throw new Error("User not found or repositories are private");
      }
      if (error.status === 422) {
        throw new Error("Invalid username");
      }
      if (error.status >= 500) {
        throw new Error("GitHub API server error. Please try again later");
      }
  
      throw new Error(`GitHub API error: ${error.message || "Unknown error"}`);
    }
  }

  export async function listRepoIssues(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
    perPage: number = 30,
    page: number = 1
  ): Promise<any[]> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_TOKEN not configured in environment");
    if (!owner || !repo) throw new Error("Owner and repo are required");
  
    const octokit = new Octokit({
      auth: token,
      userAgent: "PullQuest-Backend v1.0.0",
    });
  
    try {
      const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues', {
        owner,
        repo,
        state,
        per_page: perPage,
        page,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        }
      });
      return data;
    } catch (error: any) {
      console.error("GitHub API Error:", error);
  
      if (error.status === 401) throw new Error("Invalid GitHub token in environment");
      if (error.status === 403) throw new Error("API rate limit exceeded or insufficient permissions");
      if (error.status === 404) throw new Error("Repository not found");
      if (error.status === 422) throw new Error("Invalid owner or repo");
      if (error.status >= 500) throw new Error("GitHub API server error. Try later");
  
      throw new Error(`GitHub API error: ${error.message || "Unknown error"}`);
    }
  }