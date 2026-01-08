import { DatabaseService } from './DatabaseService';

export interface SkillGapWarning {
  hasWarning: boolean;
  message?: string;
  details?: {
    highestPlayer: {
      username: string;
      valorantRank: string;
      discordRank: string;
      mmr: number;
    };
    lowestPlayer: {
      username: string;
      valorantRank: string;
      discordRank: string;
      mmr: number;
    };
    gap: number;
  };
}

export class SkillGapAnalyzer {
  private databaseService: DatabaseService;
  private readonly SIGNIFICANT_GAP_THRESHOLD = 1500; // MMR difference

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  /**
   * Analyze queue for skill gaps (only runs when queue is full or requested)
   * Follows guardrails: error handling, logging, null checks
   */
  async analyzeQueue(playerUserIds: string[]): Promise<SkillGapWarning> {
    try {
      // Get all players from database
      const players = await Promise.all(
        playerUserIds.map(async (userId) => {
          const player = await this.databaseService.getPlayer(userId);
          return player;
        })
      );

      // Filter out null players
      const validPlayers = players.filter((p) => p !== null);

      if (validPlayers.length < 2) {
        return { hasWarning: false };
      }

      // Find highest and lowest MMR
      const sortedByMMR = [...validPlayers].sort((a, b) => b.current_mmr - a.current_mmr);
      const highest = sortedByMMR[0];
      const lowest = sortedByMMR[sortedByMMR.length - 1];
      const mmrGap = highest.current_mmr - lowest.current_mmr;

      // Check for significant Discord MMR gap
      if (mmrGap >= this.SIGNIFICANT_GAP_THRESHOLD) {
        return {
          hasWarning: true,
          message:
            `⚠️ **Large skill gap detected in queue!**\n\n` +
            `Highest: **${highest.discord_username}** [${highest.discord_rank}] (${highest.current_mmr} MMR)\n` +
            `Lowest: **${lowest.discord_username}** [${lowest.discord_rank}] (${lowest.current_mmr} MMR)\n` +
            `Gap: **${mmrGap} MMR**\n\n` +
            `Games may be imbalanced. Consider adjusting teams or waiting for more similar-ranked players.`,
          details: {
            highestPlayer: {
              username: highest.discord_username,
              valorantRank: 'N/A',
              discordRank: highest.discord_rank,
              mmr: highest.current_mmr,
            },
            lowestPlayer: {
              username: lowest.discord_username,
              valorantRank: 'N/A',
              discordRank: lowest.discord_rank,
              mmr: lowest.current_mmr,
            },
            gap: mmrGap,
          },
        };
      }

      return { hasWarning: false };
    } catch (error) {
      console.error('Error analyzing skill gap', {
        error: error instanceof Error ? error.message : String(error),
      });
      return { hasWarning: false }; // Fail gracefully
    }
  }
}
