import mongoose, { Schema, Document } from "mongoose";

// Define interfaces for nested objects (reusing from MaintainerIssue)
interface IUser {
  id: number;
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  type: string;
}

interface ILabel {
  id: number;
  name: string;
  color: string;
  description: string;
}

interface IMilestone {
  id: number;
  title: string;
  description: string;
  state: string;
  dueOn?: Date;
}

interface IRepository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  language: string;
  stargazersCount: number;
  forksCount: number;
  description: string;
}

// Additional interfaces specific to PRs
interface ICommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: Date;
  };
  url: string;
}

interface IReviewRequest {
  user: IUser;
  requestedAt: Date;
}

interface IReview {
  id: number;
  user: IUser;
  state: string; // "APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"
  body: string;
  submittedAt: Date;
  htmlUrl: string;
}

// Main interface for MergedPR
export interface IMergedPR extends Document {
  // Core PR fields
  id: number;
  number: number;
  title: string;
  body: string;
  state: string; // Should be "closed" for merged PRs
  htmlUrl: string;
  
  // User/Assignment fields
  user: IUser; // PR author
  assignee?: IUser;
  assignees: IUser[];
  
  // Metadata
  labels: ILabel[];
  milestone?: IMilestone;
  repository: IRepository;
  
  // PR specific fields
  head: {
    ref: string; // branch name
    sha: string; // commit SHA
    repo: IRepository;
  };
  base: {
    ref: string; // usually "main" or "master"
    sha: string;
    repo: IRepository;
  };
  
  // Merge information
  merged: boolean;
  mergedAt: Date;
  mergedBy: IUser;
  mergeCommitSha: string;
  
  // PR statistics
  commits: number;
  additions: number;
  deletions: number;
  changedFiles: number;
  commentsCount: number;
  reviewCommentsCount: number;
  
  // Review information
  reviewRequests: IReviewRequest[];
  reviews: IReview[];
  
  // Commit information
  commitsList: ICommit[];
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date;
  
  // GitHub specific
  authorAssociation: string;
  isDraft: boolean;
  
  // Bounty/Reward fields (from original issue)
  difficulty?: string;
  estimatedHours?: number;
  bounty?: number;
  xpReward?: number;
  stakingRequired: number;
  
  // New reward fields for merged PRs
  addedXp: number; // XP actually awarded after merge
  coinsAdded: number; // Coins/tokens awarded after merge
  
  // Additional tracking
  linkedIssues: number[]; // Issue numbers that this PR closes/fixes
  expirationDate?: Date;
  
  // Merge quality metrics
  conflictsResolved: boolean;
  ciPassed: boolean;
  reviewsApproved: number;
  reviewsChangesRequested: number;
}

// User schema (reused)
const UserSchema = new Schema({
  id: { type: Number, required: true },
  login: { type: String, required: true },
  avatarUrl: { type: String, default: "" },
  htmlUrl: { type: String, default: "" },
  type: { type: String, default: "User" }
}, { _id: false });

// Label schema (reused)
const LabelSchema = new Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  color: { type: String, default: "000000" },
  description: { type: String, default: "" }
}, { _id: false });

// Milestone schema (reused)
const MilestoneSchema = new Schema({
  id: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  state: { type: String, default: "open" },
  dueOn: { type: Date, required: false }
}, { _id: false });

// Repository schema (reused)
const RepositorySchema = new Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  htmlUrl: { type: String, required: true },
  language: { type: String, default: "" },
  stargazersCount: { type: Number, default: 0 },
  forksCount: { type: Number, default: 0 },
  description: { type: String, default: "" }
}, { _id: false });

// Commit schema
const CommitSchema = new Schema({
  sha: { type: String, required: true },
  message: { type: String, required: true },
  author: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    date: { type: Date, required: true }
  },
  url: { type: String, required: true }
}, { _id: false });

// Review request schema
const ReviewRequestSchema = new Schema({
  user: { type: UserSchema, required: true },
  requestedAt: { type: Date, required: true }
}, { _id: false });

// Review schema
const ReviewSchema = new Schema({
  id: { type: Number, required: true },
  user: { type: UserSchema, required: true },
  state: { 
    type: String, 
    required: true,
    enum: ["APPROVED", "CHANGES_REQUESTED", "COMMENTED", "DISMISSED"]
  },
  body: { type: String, default: "" },
  submittedAt: { type: Date, required: true },
  htmlUrl: { type: String, required: true }
}, { _id: false });

// Branch info schema
const BranchSchema = new Schema({
  ref: { type: String, required: true },
  sha: { type: String, required: true },
  repo: { type: RepositorySchema, required: true }
}, { _id: false });

// Main MergedPR schema
const MergedPRSchema = new Schema({
  // Core PR fields
  id: { type: Number, required: true, unique: true },
  number: { type: Number, required: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  state: { type: String, default: "closed" }, // merged PRs are closed
  htmlUrl: { type: String, required: true },
  
  // User/Assignment fields
  user: { type: UserSchema, required: true },
  assignee: { type: UserSchema, required: false },
  assignees: { type: [UserSchema], default: [] },
  
  // Metadata
  labels: { type: [LabelSchema], default: [] },
  milestone: { type: MilestoneSchema, required: false },
  repository: { type: RepositorySchema, required: true },
  
  // PR specific fields
  head: { type: BranchSchema, required: true },
  base: { type: BranchSchema, required: true },
  
  // Merge information
  merged: { type: Boolean, default: true },
  mergedAt: { type: Date, required: true },
  mergedBy: { type: UserSchema, required: true },
  mergeCommitSha: { type: String, required: true },
  
  // PR statistics
  commits: { type: Number, default: 0 },
  additions: { type: Number, default: 0 },
  deletions: { type: Number, default: 0 },
  changedFiles: { type: Number, default: 0 },
  commentsCount: { type: Number, default: 0 },
  reviewCommentsCount: { type: Number, default: 0 },
  
  // Review information
  reviewRequests: { type: [ReviewRequestSchema], default: [] },
  reviews: { type: [ReviewSchema], default: [] },
  
  // Commit information
  commitsList: { type: [CommitSchema], default: [] },
  
  // Timestamps
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  closedAt: { type: Date, required: true },
  
  // GitHub specific
  authorAssociation: { 
    type: String, 
    default: "NONE",
    enum: ["COLLABORATOR", "CONTRIBUTOR", "FIRST_TIMER", "FIRST_TIME_CONTRIBUTOR", "MANNEQUIN", "MEMBER", "NONE", "OWNER"]
  },
  isDraft: { type: Boolean, default: false },
  
  // Bounty/Reward fields (from original issue)
  difficulty: { 
    type: String, 
    required: false,
    enum: ["easy", "medium", "hard", "expert"]
  },
  estimatedHours: { type: Number, required: false },
  bounty: { type: Number, required: false },
  xpReward: { type: Number, required: false },
  stakingRequired: { type: Number, default: 0 },
  
  // New reward fields for merged PRs
  addedXp: { type: Number, default: 0 }, // XP actually awarded after merge
  coinsAdded: { type: Number, default: 0 }, // Coins/tokens awarded after merge
  
  // Additional tracking
  linkedIssues: { type: [Number], default: [] }, // Issue numbers that this PR closes/fixes
  expirationDate: { type: Date, required: false },
  
  // Merge quality metrics
  conflictsResolved: { type: Boolean, default: false },
  ciPassed: { type: Boolean, default: true },
  reviewsApproved: { type: Number, default: 0 },
  reviewsChangesRequested: { type: Number, default: 0 }
}, {
  timestamps: true // This will automatically manage createdAt and updatedAt
});

// Create indexes for better query performance
MergedPRSchema.index({ 'repository.fullName': 1 });
MergedPRSchema.index({ 'user.login': 1 });
MergedPRSchema.index({ 'mergedBy.login': 1 });
MergedPRSchema.index({ mergedAt: -1 });
MergedPRSchema.index({ createdAt: -1 });
MergedPRSchema.index({ state: 1 });
MergedPRSchema.index({ merged: 1 });
MergedPRSchema.index({ difficulty: 1 });
MergedPRSchema.index({ addedXp: -1 });
MergedPRSchema.index({ coinsAdded: -1 });

// Compound indexes for common queries
MergedPRSchema.index({ 'repository.fullName': 1, mergedAt: -1 });
MergedPRSchema.index({ 'user.login': 1, mergedAt: -1 });

// Model
const MergedPR = mongoose.model<IMergedPR>('MergedPR', MergedPRSchema);

export default MergedPR;