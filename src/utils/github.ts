import { Octokit } from "@octokit/core";

export async function listUserOrgs(
  userAccessToken: string,
  perPage: number = 30,
  page: number = 1
): Promise<any[]> {
  if (!userAccessToken) {
    throw new Error("User access token is required");
  }

  const octokit = new Octokit({
    auth: userAccessToken,
    userAgent: "PullQuest-Backend v1.0.0",
  });

  try {
    const { data } = await octokit.request("GET /user/orgs", {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      per_page: perPage,
      page,
    });

    return data;
  } catch (error: any) {
    if (error.status === 401) {
      throw new Error("Invalid or expired GitHub access token");
    }
    if (error.status === 403) {
      throw new Error("Insufficient permissions. Required scopes: user or read:org");
    }
    throw new Error(`GitHub API error: ${error.message}`);
  }
}

export async function getUserProfile(userAccessToken: string): Promise<any> {
  if (!userAccessToken) {
    throw new Error("User access token is required");
  }

  const octokit = new Octokit({
    auth: userAccessToken,
    userAgent: "PullQuest-Backend v1.0.0",
  });

  try {
    const { data } = await octokit.request("GET /user", {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return data;
  } catch (error: any) {
    if (error.status === 401) {
      throw new Error("Invalid or expired GitHub access token");
    }
    throw new Error(`GitHub API error: ${error.message}`);
  }
}