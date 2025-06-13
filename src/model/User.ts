import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  email: string;
  password: string;
  role: "contributor" | "maintainer" | "company";
  githubUsername?: string;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    required: true,
    enum: ["contributor", "maintainer", "company"],
  },
  githubUsername: {
    type: String,
    required: function (this: IUser) {
      return this.role === "contributor" || this.role === "maintainer";
    },
  },
});

export default mongoose.model<IUser>("User", userSchema);
