// src/services/issueIngestService.ts
import GitHubIssuesModel from "../model/githubIssues";

export interface IngestParams {
  userId: string;
  githubUsername: string;
  repository: { owner: string; repo: string };
  issue: any;
  stakingRequired?: number;
}

export async function ingestIssueData(params: IngestParams) {
  const { userId, githubUsername, repository, issue, stakingRequired = 0 } = params;

  // 1) find or create this user’s GitHubIssues doc
  let doc = await GitHubIssuesModel.findOne({ userId });
  if (!doc) {
    doc = new GitHubIssuesModel({
      userId,
      githubUsername,
      suggestedIssues: [],
      userTopLanguages: [],
      userOrganizations: [],
      filters: { languages: [], labels: [] },
    });
  }

  // 2) attach the new issue (with the stake) into suggestedIssues
  ;(issue as any).stakingRequired = stakingRequired;
  doc.suggestedIssues.push(issue);

  // 3) save
  await doc.save();
}
