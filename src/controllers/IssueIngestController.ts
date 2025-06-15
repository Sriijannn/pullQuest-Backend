import { RequestHandler } from "express";
import User from "../model/User";
import { Octokit } from "@octokit/rest";
import MaintainerIssue from "../model/MaintainerIssues"; // Import the new model
import mongoose from "mongoose";

export const ingestIssue: RequestHandler = async (req, res) => {
  try {
    const {
      userId,
      githubUsername,
      repository,
      issue: gh,
      stakingRequired,
      userAccessToken,
      // Additional fields for bounty/staking
      difficulty,
      estimatedHours,
      bounty,
      xpReward,
      expirationDate,
    } = req.body as {
      userId?: string;
      githubUsername: string;
      repository: { owner: string; repo: string };
      issue: any;
      stakingRequired?: number;
      userAccessToken?: string;
      difficulty?: string;
      estimatedHours?: number;
      bounty?: number;
      xpReward?: number;
      expirationDate?: string;
    };

    console.log("Ingest request body:", {
      hasUserId: !!userId,
      hasGithubUsername: !!githubUsername,
      hasRepository: !!repository,
      hasIssue: !!gh,
      repository,
      githubUsername,
      stakingRequired,
      issueId: gh?.id,
      issueNumber: gh?.number,
    });

    // Add validation
    if (!gh || !githubUsername || !repository) {
      console.error("Missing required fields:", {
        githubUsername: !!githubUsername,
        repository: !!repository,
        issue: !!gh
      });
      res.status(400).json({ 
        success: false, 
        message: "Missing required fields: githubUsername, repository, or issue data" 
      });
      return;
    }

    // Validate issue ID
    if (!gh.id || !gh.number) {
      console.error("Invalid issue data: missing id or number");
      res.status(400).json({ 
        success: false, 
        message: "Invalid issue data: missing id or number" 
      });
      return;
    }

    // 1) Find user by githubUsername
    console.log(`Looking up user with githubUsername: ${githubUsername}`);
    const user = await User.findOne({ githubUsername }).select("_id githubUsername email role");
    
    if (!user) {
      console.error(`User not found with githubUsername: ${githubUsername}`);
      res.status(404).json({ 
        success: false, 
        message: `User not found with GitHub username: ${githubUsername}` 
      });
      return;
    }

    const actualUserId = (user._id as mongoose.Types.ObjectId).toString();
    console.log(`Found user: ${actualUserId} (${user.githubUsername})`);

    // 2) Check if issue already exists in MaintainerIssue collection
    const existingIssue = await MaintainerIssue.findOne({ id: gh.id });
    if (existingIssue) {
      console.log(`Issue ${gh.id} already exists, updating...`);
      
      // Update existing issue with new data
      const updatedIssue = await MaintainerIssue.findOneAndUpdate(
        { id: gh.id },
        {
          // Update core fields that might change
          title: gh.title || existingIssue.title,
          body: gh.body !== undefined ? gh.body : existingIssue.body,
          state: gh.state || existingIssue.state,
          updatedAt: gh.updated_at ? new Date(gh.updated_at) : new Date(),
          closedAt: gh.closed_at ? new Date(gh.closed_at) : existingIssue.closedAt,
          commentsCount: gh.comments !== undefined ? gh.comments : existingIssue.commentsCount,
          
          // Update bounty/staking fields if provided
          ...(stakingRequired !== undefined && { stakingRequired }),
          ...(difficulty && { difficulty }),
          ...(estimatedHours !== undefined && { estimatedHours }),
          ...(bounty !== undefined && { bounty }),
          ...(xpReward !== undefined && { xpReward }),
          ...(expirationDate && { expirationDate: new Date(expirationDate) }),
          
          // Update labels and assignees
          labels: (gh.labels || []).map((lbl: any) => ({
            id: lbl?.id || 0,
            name: lbl?.name || "",
            color: lbl?.color || "000000",
            description: lbl?.description || "",
          })),
          assignee: gh.assignee ? {
            id: gh.assignee.id,
            login: gh.assignee.login,
            avatarUrl: gh.assignee.avatar_url || "",
            htmlUrl: gh.assignee.html_url || "",
            type: gh.assignee.type || "User",
          } : undefined,
          assignees: (gh.assignees || []).map((u: any) => ({
            id: u.id,
            login: u.login,
            avatarUrl: u.avatar_url || "",
            htmlUrl: u.html_url || "",
            type: u.type || "User",
          })),
        },
        { new: true, runValidators: true }
      );

      res.status(200).json({ 
        success: true, 
        issueId: updatedIssue!.id,
        issueNumber: updatedIssue!.number,
        repository: updatedIssue!.repository.fullName,
        stakingRequired: updatedIssue!.stakingRequired,
        message: "Issue updated successfully",
        updated: true
      });
      return;
    }

    // 3) Fetch repository data if needed
    let repositoryData = gh.repository;
    if (!repositoryData && userAccessToken) {
      try {
        console.log(`Fetching repository data for ${repository.owner}/${repository.repo}`);
        const octokit = new Octokit({ auth: userAccessToken });
        const { data: repoData } = await octokit.rest.repos.get({
          owner: repository.owner,
          repo: repository.repo,
        });
        repositoryData = repoData;
        console.log("Repository data fetched successfully");
      } catch (repoError: any) {
        console.warn("Could not fetch repository data:", repoError.message);
      }
    }

    // 4) Create new MaintainerIssue document
    const newMaintainerIssue = new MaintainerIssue({
      // Core issue fields
      id: gh.id,
      number: gh.number,
      title: gh.title || "Untitled Issue",
      body: gh.body || "",
      state: gh.state || "open",
      htmlUrl: gh.html_url || "",
      
      // User fields
      user: gh.user ? {
        id: gh.user.id,
        login: gh.user.login,
        avatarUrl: gh.user.avatar_url || "",
        htmlUrl: gh.user.html_url || "",
        type: gh.user.type || "User",
      } : {
        id: 0,
        login: "unknown",
        avatarUrl: "",
        htmlUrl: "",
        type: "User",
      },
      
      // Labels
      labels: (gh.labels || []).map((lbl: any) => ({
        id: lbl?.id || 0,
        name: lbl?.name || "",
        color: lbl?.color || "000000",
        description: lbl?.description || "",
      })),
      
      // Assignee and assignees
      assignee: gh.assignee ? {
        id: gh.assignee.id,
        login: gh.assignee.login,
        avatarUrl: gh.assignee.avatar_url || "",
        htmlUrl: gh.assignee.html_url || "",
        type: gh.assignee.type || "User",
      } : undefined,
      
      assignees: (gh.assignees || []).map((u: any) => ({
        id: u.id,
        login: u.login,
        avatarUrl: u.avatar_url || "",
        htmlUrl: u.html_url || "",
        type: u.type || "User",
      })),
      
      // Milestone
      milestone: gh.milestone ? {
        id: gh.milestone.id,
        title: gh.milestone.title || "",
        description: gh.milestone.description || "",
        state: gh.milestone.state || "open",
        dueOn: gh.milestone.due_on ? new Date(gh.milestone.due_on) : undefined,
      } : undefined,
      
      // Repository data
      repository: repositoryData ? {
        id: repositoryData.id,
        name: repositoryData.name,
        fullName: repositoryData.full_name || `${repository.owner}/${repository.repo}`,
        htmlUrl: repositoryData.html_url || `https://github.com/${repository.owner}/${repository.repo}`,
        language: repositoryData.language || "",
        stargazersCount: repositoryData.stargazers_count || 0,
        forksCount: repositoryData.forks_count || 0,
        description: repositoryData.description || "",
      } : {
        id: 0,
        name: repository.repo,
        fullName: `${repository.owner}/${repository.repo}`,
        htmlUrl: `https://github.com/${repository.owner}/${repository.repo}`,
        language: "",
        stargazersCount: 0,
        forksCount: 0,
        description: "",
      },
      
      // Counts and timestamps
      commentsCount: gh.comments || 0,
      createdAt: gh.created_at ? new Date(gh.created_at) : new Date(),
      updatedAt: gh.updated_at ? new Date(gh.updated_at) : new Date(),
      closedAt: gh.closed_at ? new Date(gh.closed_at) : undefined,
      
      // GitHub specific
      authorAssociation: gh.author_association || "NONE",
      
      // Bounty/Staking fields
      difficulty: difficulty,
      estimatedHours: estimatedHours,
      bounty: bounty,
      xpReward: xpReward,
      stakingRequired: stakingRequired || 0,
      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
    });

    // 5) Save the new MaintainerIssue
    const savedIssue = await newMaintainerIssue.save();
    console.log("✅ New MaintainerIssue created:", savedIssue.id);

    // Issue successfully saved to MaintainerIssue collection

    console.log("✅ Issue ingested successfully:", {
      userId: actualUserId,
      issueId: savedIssue.id,
      issueNumber: savedIssue.number,
      issueTitle: savedIssue.title,
      repository: savedIssue.repository.fullName,
      stakingRequired: savedIssue.stakingRequired,
    });

    res.status(201).json({ 
      success: true, 
      issueId: savedIssue.id,
      issueNumber: savedIssue.number,
      repository: savedIssue.repository.fullName,
      stakingRequired: savedIssue.stakingRequired,
      difficulty: savedIssue.difficulty,
      bounty: savedIssue.bounty,
      xpReward: savedIssue.xpReward,
      message: "Issue ingested successfully",
      created: true
    });
    
  } catch (err: any) {
    console.error("❌ Error ingesting issue:", err);
    
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map((e: any) => e.message);
      res.status(400).json({ 
        success: false, 
        message: "Validation error", 
        errors: validationErrors 
      });
      return;
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      res.status(409).json({ 
        success: false, 
        message: "Issue already exists with this ID" 
      });
      return;
    }
    
    res.status(500).json({ success: false, message: err.message });
  }
};