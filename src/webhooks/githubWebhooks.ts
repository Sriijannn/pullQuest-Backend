import { Request, Response } from "express";
import Stake, { StakeStatus } from "../model/stake";

export const handlePRWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const event = req.headers["x-github-event"];
    const payload = req.body;

    if (event === "pull_request") {
      const { action, pull_request } = payload;
      const prUrl = pull_request.html_url;

      const stake = await Stake.findOne({ prUrl });
      if (!stake) return;

      switch (action) {
        case "closed":
          if (pull_request.merged) {
            stake.status = StakeStatus.ACCEPTED;
          } else {
            stake.status = StakeStatus.REJECTED;
          }
          break;

        case "reopened":
          stake.status = StakeStatus.PENDING;
          break;
      }

      await stake.save();
    }

    res.status(200).send("Webhook Processed");
  } catch (error) {
    console.error("Webhook error: ", error);
    res.status(500).send("Internal server error");
  }
};
