import { Router } from "express";
import fetch from "node-fetch";
import { Request, Response, NextFunction } from "express";
import {
  GitHubOrganizationsService,
  IOrganization,
} from "../services/githubService";

const orgService = new GitHubOrganizationsService(process.env.GITHUB_TOKEN);

// extend session type
declare module "express-session" {
  interface SessionData {
    user?: {
      githubId: number;
      login: string;
      avatar: string;
    };
  }
}

const router = Router();

router.get("/github/orgs/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const orgs: IOrganization[] = await orgService.getUserOrganizations(
      username
    );
    res.json(orgs);
  } catch (err) {
    next(err);
  }
});

// 2️⃣ Fetch all (public+private) orgs for *your* token
router.get("/github/orgs", async (req, res, next) => {
  try {
    // no username → uses /user/orgs under the hood
    const orgs: IOrganization[] = await orgService.getUserOrganizations();
    res.json(orgs);
  } catch (err) {
    next(err);
  }
});

// Initiate GitHub OAuth flow
router.get(
  "/auth/github",
  (_req: Request, res: Response, next: NextFunction) => {
    try {
      const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID as string,
        redirect_uri: process.env.GITHUB_CALLBACK_URL as string,
        scope: "read:user user:email",
      });
      res.redirect(`https://github.com/login/oauth/authorize?${params}`);
    } catch (err) {
      next(err);
    }
  }
);

// Handle callback
router.get(
  "/auth/callback/github",
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const code = req.query.code as string;
      if (!code) {
        res.status(400).send("Missing code");
        return;
      }

      // Exchange code for token
      fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      })
        .then((tokenResp) => tokenResp.json())
        .then((tokenJson: any) => {
          const access_token = tokenJson.access_token as string;
          if (!access_token) {
            res
              .status(401)
              .json({
                error: tokenJson.error_description || "Token exchange failed",
              });
            return;
          }

          // Fetch profile
          return fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${access_token}` },
          });
        })
        .then((userResp) => userResp?.json())
        .then((profile: any) => {
          // Store in session
          req.session.user = {
            githubId: profile.id,
            login: profile.login,
            avatar: profile.avatar_url,
          };

          // Redirect to front-end
          res.redirect("http://localhost:3000/");
        })
        .catch((err) => next(err));
    } catch (err) {
      next(err);
    }
  }
);

export default router;
