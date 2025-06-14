import mongoose, { Document, Schema, Types } from "mongoose";

export enum StakeStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

export interface IStake extends Document {
  userId: Types.ObjectId;
  issueId: number;
  repository: string;
  amount: number;
  status: StakeStatus;
  prUrl: string;
  xpEarned?: number;
  coinsEarned?: number;
  createdAt: Date;
  updatedAt: Date;
}

const stakeSchema = new Schema<IStake>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    issueId: {
      type: Number,
      required: true,
    },
    repository: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(StakeStatus),
      default: StakeStatus.PENDING,
    },
    prUrl: {
      type: String,
      required: true,
    },
    xpEarned: {
      type: Number,
      min: 0,
    },
    coinsEarned: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

stakeSchema.index({ userId: 1 });
stakeSchema.index({ issueId: 1 });
stakeSchema.index({ status: 1 });

const Stake = mongoose.model<IStake>("Stake", stakeSchema);

export default Stake;
