export class CoinUtils {
  static calculateStake(issueBounty: number): number {
    return Math.floor(issueBounty * 0.3);
  }

  static calculateEarnings(
    stake: number,
    outcome: "accepted" | "rejected"
  ): number {
    return outcome === "accepted" ? stake * 2 : Math.floor(stake * 0.5);
  }

  static calculateXPGain(
    issueXP: number,
    outcome: "accepted" | "rejected"
  ): number {
    return outcome === "accepted" ? issueXP : Math.floor(issueXP * 0.2);
  }
}
