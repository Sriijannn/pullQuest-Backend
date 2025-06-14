import mongoose, { DateExpression, Document, Schema, Types } from "mongoose";

export interface IRepository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  description?: string;
  language?: string;
  stargazersCount: number;
  forksCount: number;
  size: number;
  createdAt: Date;
  updatedAt: Date;
  topics: string[];
  visibility: string;
}

export interface ILanguageStats {
  count: number;
  percentage: number;
  totalBytes: number;
}

export interface IGitHubRepository extends Document {
  userId: Types.ObjectId;
  githubUsername: string;
  repositories: IRepository[];
  organizations: string[];
  languageStats: Map<string, ILanguageStats>;
  topLanguages: string[];
  lastAnalyzed: Date;
  createdAt: Date;
  updatedAt: Date;
}

const repositorySchema = new Schema<IRepository>({
  id: { type: Number, required: true },
  name: { type: String, required: true },
  fullName: { type: String, required: true },
  htmlUrl: { type: String, required: true },
  description: { type: String },
  language: { type: String },
  stargazersCount: { type: Number, default: 0 },
  forksCount: { type: Number, default: 0 },
  size: { type: Number, default: 0 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  topics: [{ type: String }],
  visibility: { type: String, required: true },
});

const languageStatsSchema = new Schema<ILanguageStats>({
  count: { type: Number, required: true },
  percentage: { type: Number, required: true },
  totalBytes: { type: Number, required: true },
});

const gitHubRepositorySchema = new Schema<IGitHubRepository>(
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
    repositories: [repositorySchema],
    organizations: [{ type: String }],
    languageStats: {
      type: Map,
      of: languageStatsSchema,
    },
    topLanguages: [{ type: String }],
    lastAnalyzed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IGitHubRepository>(
  "GitHubRepository",
  gitHubRepositorySchema
);
