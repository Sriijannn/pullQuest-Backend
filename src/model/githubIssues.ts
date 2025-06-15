import mongoose, { Document, Schema, Types } from "mongoose";

export interface IIssueLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface IIssueUser {
  id: number;
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  type: string;
}

export interface IIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  htmlUrl: string;
  user: IIssueUser;
  labels: IIssueLabel[];
  assignee?: IIssueUser;
  assignees: IIssueUser[];
  milestone?: {
    id: number;
    title: string;
    description?: string;
    state: string;
    dueOn?: Date;
  };
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  authorAssociation: string;
  repository: {
    id: number;
    name: string;
    fullName: string;
    htmlUrl: string;
    language?: string;
    stargazersCount: number;
    forksCount: number;
    description?: string;
  };
  difficulty?: "beginner" | "intermediate" | "advanced";
  estimatedHours?: number;
  bounty?: number;
  xpReward?: number;
  stakingRequired?: number;
  expirationDate?: Date;
}

export interface IGitHubIssues extends Document {
  userId: Types.ObjectId;
  githubUsername: string;
  suggestedIssues: IIssue[];
  userTopLanguages: string[];
  userOrganizations: string[];
  lastFetched: Date;
  filters: {
    languages: string[];
    labels: string[];
    difficulty?: string;
    minStars?: number;
    minBounty?: number;
    maxBounty?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const issueLabelSchema = new Schema<IIssueLabel>({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  color: { type: String, required: true },
  description: { type: String },
});

const issueUserSchema = new Schema<IIssueUser>({
  id: { type: Number, required: true },
  login: { type: String, required: true },
  avatarUrl: { type: String, required: true },
  htmlUrl: { type: String, required: true },
  type: { type: String, required: true },
});
const issueSchema = new Schema<IIssue>({
  id: { type: Number, required: true },
  number: { type: Number, required: true },
  title: { type: String, required: true },
  body: { type: String },
  state: { type: String, required: true },
  htmlUrl: { type: String, required: true },
  user: { type: issueUserSchema, required: true },
  labels: [issueLabelSchema],
  assignee: issueUserSchema,
  assignees: [issueUserSchema],
  milestone: {
    id: { type: Number },
    title: { type: String },
    description: { type: String },
    state: { type: String },
    dueOn: { type: Date },
  },
  commentsCount: { type: Number, default: 0 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  closedAt: { type: Date },
  authorAssociation: { type: String, required: true },
  repository: {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    htmlUrl: { type: String, required: true },
    language: { type: String },
    stargazersCount: { type: Number, default: 0 },
    forksCount: { type: Number, default: 0 },
    description: { type: String },
  },
  difficulty: {
    type: String,
    enum: ["beginner", "intermediate", "advanced"],
  },
  estimatedHours: { type: Number },
  // ADD THESE MISSING FIELDS:
  bounty: { type: Number },
  xpReward: { type: Number },
  stakingRequired: { type: Number, default: 0 }, // ← This was missing!
  expirationDate: { type: Date },
});

const gitHubIssuesSchema = new Schema<IGitHubIssues>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    githubUsername: {
      type: String,
      required: true,
    },
    suggestedIssues: [issueSchema],
    userTopLanguages: [{ type: String }],
    userOrganizations: [{ type: String }],
    lastFetched: {
      type: Date,
      default: Date.now,
    },
    filters: {
      languages: [{ type: String }],
      labels: [{ type: String }],
      difficulty: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
      },
      minStars: { type: Number, default: 0 },
      minBounty: { type: Number },
      maxBounty: { type: Number },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
gitHubIssuesSchema.index({ userId: 1 });
gitHubIssuesSchema.index({ githubUsername: 1 });
gitHubIssuesSchema.index({ "suggestedIssues.repository.language": 1 });
gitHubIssuesSchema.index({ lastFetched: 1 });

export default mongoose.model<IGitHubIssues>(
  "GitHubIssues",
  gitHubIssuesSchema
);
