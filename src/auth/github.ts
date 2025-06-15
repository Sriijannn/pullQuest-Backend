import passport from "passport";
import {
  Strategy as GitHubStrategy,
  Profile as GitHubProfile,
} from "passport-github2";
import { VerifyCallback } from "passport-oauth2";
import dotenv from "dotenv";

dotenv.config();

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj: any, done) => {
  done(null, obj);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      callbackURL: "http://localhost:8012/auth/github/callback",
      scope: [
        "read:user",
        "user:email", 
        "repo", 
        "read:org",
        "write:repo_hook",
        "admin:repo_hook", 
        "write:repo_hook", 
        "admin:repo_hook", 
      ]
    },
    
    function (
      accessToken: string,
      refreshToken: string,
      profile: GitHubProfile,
      done: VerifyCallback
    ) {
      const user = {
        profile,
        accessToken,
        refreshToken,
      };
      return done(null, user);
    }    
  )
);
