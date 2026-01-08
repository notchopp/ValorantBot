import { GuildMember } from 'discord.js';
import { Config } from '../config/config';
import { PlayerService } from './PlayerService';
import { ValorantAPIService } from './ValorantAPIService';

export class RankService {
  private config: Config;
  private playerService: PlayerService;
  private valorantAPI?: ValorantAPIService;

  constructor(config: Config, playerService: PlayerService, valorantAPI?: ValorantAPIService) {
    this.config = config;
    this.playerService = playerService;
    this.valorantAPI = valorantAPI;
  }

  /**
   * Get player rank - prioritizes Valorant API, falls back to Discord roles, then manual
   */
  async getPlayerRank(member: GuildMember, userId: string): Promise<{ rank: string; rankValue: number } | null> {
    const player = await this.playerService.getPlayer(userId);
    
    // First, try to get from Valorant API if player has Riot ID linked
    if (player?.riotId && this.valorantAPI) {
      try {
        const region = player.riotId.region || this.config.valorantAPI.defaultRegion;
        // Use getRankWithFallback to handle unranked/placement players
        const mmr = await this.valorantAPI.getRankWithFallback(
          region,
          player.riotId.name,
          player.riotId.tag
        );
        
        if (mmr && mmr.currenttierpatched) {
          const rankValue = this.valorantAPI.getRankValueFromMMR(mmr);
          // Update player's cached rank
          if (player) {
            player.rank = mmr.currenttierpatched;
            player.rankValue = rankValue;
          }
          return { rank: mmr.currenttierpatched, rankValue };
        }
      } catch (error) {
        // Fall through to Discord roles if API fails
        console.error(`Error fetching rank from API for ${userId}:`, error);
      }
    }

    // Fallback: Check Discord roles
    const rankFromRoles = this.getPlayerRankFromRoles(member);
    if (rankFromRoles) {
      return rankFromRoles;
    }

    // Last resort: Check if player has manually set rank
    if (player?.rank && player.rankValue !== undefined) {
      return { rank: player.rank, rankValue: player.rankValue };
    }

    return null;
  }

  /**
   * Get rank from Discord roles (fallback method)
   */
  getPlayerRankFromRoles(member: GuildMember): { rank: string; rankValue: number } | null {
    const rankRoles = member.roles.cache.filter((role) =>
      this.config.ranks.roleNames.some((rankName) =>
        role.name.toLowerCase().includes(rankName.toLowerCase())
      )
    );

    if (rankRoles.size === 0) {
      return null;
    }

    // Get the highest rank role
    let highestRank: { rank: string; rankValue: number } | null = null;

    rankRoles.forEach((role) => {
      for (const rankName of this.config.ranks.roleNames) {
        if (role.name.toLowerCase().includes(rankName.toLowerCase())) {
          const rankValue = this.config.ranks.numericValues[rankName];
          if (!highestRank || rankValue > highestRank.rankValue) {
            highestRank = { rank: rankName, rankValue };
          }
        }
      }
    });

    return highestRank;
  }

  isValidRank(rank: string): boolean {
    return rank in this.config.ranks.numericValues;
  }

  getAllRanks(): string[] {
    return [...this.config.ranks.roleNames];
  }
}
