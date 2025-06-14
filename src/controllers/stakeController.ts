import { Request, Response } from "express";
import Stake, { StakeStatus } from "../model/stake";
import User from "../model/User";

export class StakeController {
  public createStake = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;
      const { issueId, repository, amount, prUrl } = req.body;

      const user = await User.findById(userId);
      if (!user || user.coins < amount) {
        res.status(400).json({
          success: false,
          message: "Insufficient coins",
        });
        return;
      }

      user.coins -= amount;
      await user.save();

      const stake = new Stake({
        userId,
        issueId,
        repository,
        amount,
        prUrl,
        status: StakeStatus.PENDING,
      });

      await stake.save();

      res.status(201).json({
        success: true,
        message: "Stake created successfully",
        data: stake,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to create stake",
        error: error.message,
      });
    }
  };

  public updateStakeStatus = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { stakeId } = req.params;
      const { status, xpEarned, coinsEarned } = req.body;

      const stake = await Stake.findById(stakeId);
      if (!stake) {
        res.status(404).json({
          success: false,
          message: "Stake not found",
        });
        return;
      }

      const user = await User.findById(stake.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: "User not found",
        });
        return;
      }

      switch (status) {
        case StakeStatus.ACCEPTED:
          user.coins += stake.amount + (coinsEarned || 0);
          user.xp = (user.xp || 0) + (xpEarned || 0);
          break;

        case StakeStatus.REJECTED:
          user.coins += coinsEarned || 0;
          break;

        case StakeStatus.EXPIRED:
          user.coins += stake.amount;
          break;
      }

      stake.status = status;
      stake.xpEarned = xpEarned;
      stake.coinsEarned = coinsEarned;

      await Promise.all([stake.save(), user.save()]);

      res.status(200).json({
        success: true,
        message: "Stake status updated",
        data: stake,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to update stake",
        error: error.message,
      });
    }
  };

  public getUserStakes = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;
      const stakes = await Stake.find({ userId }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        message: "Got stakes successfully",
        data: stakes,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Failed to get stake",
        error: error.message,
      });
    }
  };
}
