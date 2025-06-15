import mongoose, { Schema, Document } from "mongoose";

// Define interfaces for nested objects
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

// Main interface for MaintainerIssue
export interface IMaintainerIssue extends Document {
  // Core issue fields
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  htmlUrl: string;
  
  // User/Assignment fields
  user: IUser;
  assignee?: IUser;
  assignees: IUser[];
  
  // Metadata
  labels: ILabel[];
  milestone?: IMilestone;
  repository: IRepository;
  
  // Counts and timestamps
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  
  // GitHub specific
  authorAssociation: string;
  
  // Bounty/Staking fields
  difficulty?: string;
  estimatedHours?: number;
  bounty?: number;
  xpReward?: number;
  stakingRequired: number;
  expirationDate?: Date;
}

// User schema
const UserSchema = new Schema({
  id: { type: Number, required: true },
  login: { type: String, required: true },
  avatarUrl: { type: String, default: "" },
  htmlUrl: { type: String, default: "" },
  type: { type: String, default: "User" }
}, { _id: false });

// Label schema
const LabelSchema = new Schema({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  color: { type: String, default: "000000" },
  description: { type: String, default: "" }
}, { _id: false });

// Milestone schema
const MilestoneSchema = new Schema({
  id: { type: Number, required: true },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  state: { type: String, default: "open" },
  dueOn: { type: Date, required: false }
}, { _id: false });

// Repository schema
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

// Main MaintainerIssue schema
const MaintainerIssueSchema = new Schema({
  // Core issue fields
  id: { type: Number, required: true, unique: true },
  number: { type: Number, required: true },
  title: { type: String, required: true },
  body: { type: String, default: "" },
  state: { type: String, default: "open", enum: ["open", "closed"] },
  htmlUrl: { type: String, required: true },
  
  // User/Assignment fields
  user: { type: UserSchema, required: true },
  assignee: { type: UserSchema, required: false },
  assignees: { type: [UserSchema], default: [] },
  
  // Metadata
  labels: { type: [LabelSchema], default: [] },
  milestone: { type: MilestoneSchema, required: false },
  repository: { type: RepositorySchema, required: true },
  
  // Counts and timestamps
  commentsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  closedAt: { type: Date, required: false },
  
  // GitHub specific
  authorAssociation: { 
    type: String, 
    default: "NONE",
    enum: ["COLLABORATOR", "CONTRIBUTOR", "FIRST_TIMER", "FIRST_TIME_CONTRIBUTOR", "MANNEQUIN", "MEMBER", "NONE", "OWNER"]
  },
  
  // Bounty/Staking fields
  difficulty: { 
    type: String, 
    required: false,
    enum: ["easy", "medium", "hard", "expert"]
  },
  estimatedHours: { type: Number, required: false },
  bounty: { type: Number, required: false },
  xpReward: { type: Number, required: false },
  stakingRequired: { type: Number, default: 0 },
  expirationDate: { type: Date, required: false }
}, {
  timestamps: true // This will automatically manage createdAt and updatedAt
});

// Create indexes for better query performance
MaintainerIssueSchema.index({ 'repository.fullName': 1 });
MaintainerIssueSchema.index({ 'user.login': 1 });
MaintainerIssueSchema.index({ state: 1 });
MaintainerIssueSchema.index({ createdAt: -1 });

// Model
const MaintainerIssue = mongoose.model<IMaintainerIssue>('MaintainerIssue', MaintainerIssueSchema);

export default MaintainerIssue;