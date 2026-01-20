import { GuildMember } from 'discord.js';
import { Config } from '../config/config';
import { PlayerService } from './PlayerService';
import { ValorantAPIService } from './ValorantAPIService';
import { MarvelRivalsAPIService, MarvelRivalsStats } from './MarvelRivalsAPIService';

export class RankService {
  private config: Config;
  private playerService: PlayerService;
  private valorantAPI?: ValorantAPIService;
  private marvelRivalsAPI?: MarvelRivalsAPIService;

  constructor(
    config: Config,
    playerService: PlayerService,
    valorantAPI?: ValorantAPIService,
    marvelRivalsAPI?: MarvelRivalsAPIService
  ) {
    this.config = config;
    this.playerService = playerService;
    this.valorantAPI = valorantAPI;
    this.marvelRivalsAPI = marvelRivalsAPI;
  }

  /**
   * Get player rank - prioritizes Valorant API, falls back to Discord roles, then manual
   */
  async getPlayerRank(
    member: GuildMember,
    userId: string,
    game?: 'valorant' | 'marvel_rivals'
  ): Promise<{ rank: string; rankValue: number; game: 'valorant' | 'marvel_rivals' } | null> {
    const player = await this.playerService.getPlayer(userId);
    const targetGame = game || player?.preferredGame || 'valorant';
    
    // First, try to get from Valorant API if player has Riot ID linked
    if (targetGame === 'valorant' && player?.riotId && this.valorantAPI) {
      try {
        const region = player.riotId.region || this.config.valorantAPI.defaultRegion;
        const mmr = await this.valorantAPI.getMMR(
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
          return { rank: mmr.currenttierpatched, rankValue, game: 'valorant' };
        }
      } catch (error) {
        // Fall through to Discord roles if API fails
        console.error(`Error fetching rank from API for ${userId}:`, error);
      }
    }

    if (targetGame === 'marvel_rivals' && player?.marvelRivalsId && this.marvelRivalsAPI) {
      try {
        const stats = await this.marvelRivalsAPI.getPlayerStats(player.marvelRivalsId.uid);
        if (stats) {
          const mapped = this.mapMarvelRankToDiscord(stats);
          if (mapped) {
            player.marvelRivalsRank = mapped.rank;
            player.marvelRivalsRankValue = mapped.rankValue;
            return { rank: mapped.rank, rankValue: mapped.rankValue, game: 'marvel_rivals' };
          }
        }
      } catch (error) {
        console.error(`Error fetching Marvel Rivals rank for ${userId}:`, error);
      }
    }

    // Fallback: Check Discord roles
    const rankFromRoles = this.getPlayerRankFromRoles(member);
    if (rankFromRoles) {
      return { ...rankFromRoles, game: targetGame };
    }

    // Last resort: Check if player has manually set rank
    if (player?.rank && player.rankValue !== undefined) {
      return { rank: player.rank, rankValue: player.rankValue, game: targetGame };
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

  getMarvelRivalsDiscordRank(stats: MarvelRivalsStats): { rank: string; rankValue: number; mmr: number } | null {
    return this.mapMarvelRankToDiscord(stats);
  }

  private mapMarvelRankToDiscord(stats: { rank?: unknown; tier?: unknown; [key: string]: unknown }): { rank: string; rankValue: number; mmr: number } | null {
    const rank = typeof stats.rank === 'string' ? stats.rank.trim() : '';
    if (!rank) {
      return null;
    }

    const tierValue = this.parseTierValue(stats.tier, rank);
    const normalized = rank.toLowerCase();

    const discordRank = this.mapMarvelTierToDiscordRank(normalized, tierValue);
    if (!discordRank) {
      return null;
    }

    const rankValue = this.getCustomRankValue(discordRank);
    const mmr = this.getCustomRankMMR(discordRank);
    return { rank: discordRank, rankValue, mmr };
  }

  private parseTierValue(tier: unknown, rank: string): number {
    if (typeof tier === 'number' && !Number.isNaN(tier)) {
      return tier;
    }
    if (typeof tier === 'string') {
      const trimmed = tier.trim().toUpperCase();
      if (trimmed === 'I') return 1;
      if (trimmed === 'II') return 2;
      if (trimmed === 'III') return 3;
      const parsed = parseInt(trimmed, 10);
      if (!Number.isNaN(parsed)) return parsed;
    }

    const match = rank.match(/\b(I{1,3}|[1-3])\b/i);
    if (match) {
      const value = match[1].toUpperCase();
      if (value === 'I') return 1;
      if (value === 'II') return 2;
      if (value === 'III') return 3;
      const parsed = parseInt(value, 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  private mapMarvelTierToDiscordRank(rank: string, tier: number): string | null {
    if (rank.includes('one above all')) return 'X';
    if (rank.includes('eternity')) return 'CHALLENGER V';

    if (rank.includes('bronze')) return this.mapTierToRank(['GRNDS I', 'GRNDS II', 'GRNDS III'], tier);
    if (rank.includes('silver')) return this.mapTierToRank(['GRNDS IV', 'GRNDS V', 'GRNDS V'], tier);
    if (rank.includes('gold')) return this.mapTierToRank(['BREAKPOINT I', 'BREAKPOINT II', 'BREAKPOINT II'], tier);
    if (rank.includes('platinum')) return this.mapTierToRank(['BREAKPOINT III', 'BREAKPOINT IV', 'BREAKPOINT IV'], tier);
    if (rank.includes('diamond')) return this.mapTierToRank(['BREAKPOINT V', 'CHALLENGER I', 'CHALLENGER I'], tier);
    if (rank.includes('grandmaster')) return this.mapTierToRank(['CHALLENGER II', 'CHALLENGER III', 'CHALLENGER III'], tier);
    if (rank.includes('celestial')) return this.mapTierToRank(['CHALLENGER IV', 'CHALLENGER V', 'CHALLENGER V'], tier);

    return null;
  }

  private mapTierToRank(options: string[], tier: number): string {
    if (!tier || tier < 1) {
      return options[0];
    }
    const index = Math.min(tier, options.length) - 1;
    return options[index];
  }

  private getCustomRankValue(rank: string): number {
    const rankMap: Record<string, number> = {
      'GRNDS I': 1,
      'GRNDS II': 2,
      'GRNDS III': 3,
      'GRNDS IV': 4,
      'GRNDS V': 5,
      'BREAKPOINT I': 6,
      'BREAKPOINT II': 7,
      'BREAKPOINT III': 8,
      'BREAKPOINT IV': 9,
      'BREAKPOINT V': 10,
      'CHALLENGER I': 11,
      'CHALLENGER II': 12,
      'CHALLENGER III': 13,
      'CHALLENGER IV': 14,
      'CHALLENGER V': 15,
      'X': 16,
    };
    return rankMap[rank] || 0;
  }

  private getCustomRankMMR(rank: string): number {
    const mmrMap: Record<string, number> = {
      'GRNDS I': 100,
      'GRNDS II': 300,
      'GRNDS III': 500,
      'GRNDS IV': 700,
      'GRNDS V': 900,
      'BREAKPOINT I': 1100,
      'BREAKPOINT II': 1300,
      'BREAKPOINT III': 1500,
      'BREAKPOINT IV': 1700,
      'BREAKPOINT V': 1900,
      'CHALLENGER I': 2100,
      'CHALLENGER II': 2300,
      'CHALLENGER III': 2500,
      'CHALLENGER IV': 2700,
      'CHALLENGER V': 2900,
      'X': 3200,
    };
    return mmrMap[rank] || 0;
  }
}
