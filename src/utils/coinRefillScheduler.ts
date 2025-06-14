import cron from "node-cron";
import User from "../model/User";

export const scheduleCoinRefill = () => {
  cron.schedule("0 0 1 * *", async () => {
    try {
      const result = await User.updateMany(
        { role: "contributor" },
        {
          $inc: { coins: 100 },
          $set: { monthlyCoinsLastRefill: new Date() },
        }
      );

      console.log(`Refilled coins for ${result.modifiedCount} contributors`);
    } catch (error) {
      console.error("Coin Refill Failed: ", error);
    }
  });
};
