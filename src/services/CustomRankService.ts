import { DatabaseService } from './DatabaseService';

export interface RankCalculationInput {
  won: boolean;
  kills: number;
  deaths: number;
  assists: number;
  mvp: boolean;
  teamMVP?: boolean; // MVP of winning team
  damage?: number;
  score?: number; // Combat score
  roundsWon?: number;
  roundsLost?: number;
}

export interface RankCalculationResult {
  pointsEarned: number;
  breakdown: {
    basePoints: number;
    performanceBonus: number;
    mvpBonus: number;
    teamMVPBonus: number;
    winStreakBonus?: number;
  };
}

/**
 * Custom rank service with sticky progression system
 * Ranks: GRNDS I-V, BREAKPOINT I-V, CHALLENGER I-V, X (top 10)
 */
export class CustomRankService {
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  /**
   * Calculate points earned from a match with weighted scoring
   * Follows guardrails: input validation, error handling
   */
  calculateMatchPoints(input: RankCalculationInput, currentMMR: number): RankCalculationResult {
    try {
      // Validate input
      if (typeof input.won !== 'boolean') {
        throw new Error('Invalid input: won must be boolean');
      }
      if (typeof currentMMR !== 'number' || isNaN(currentMMR)) {
        console.warn('Invalid currentMMR, defaulting to 0');
        currentMMR = 0;
      }
      let basePoints = 0;
      let performanceBonus = 0;
      let mvpBonus = 0;
      let teamMVPBonus = 0;

      // Validate numeric inputs
      const kills = typeof input.kills === 'number' && !isNaN(input.kills) ? input.kills : 0;
      const deaths = typeof input.deaths === 'number' && !isNaN(input.deaths) ? input.deaths : 0;
      // Note: assists not used in current calculation but kept for future use

      // Base points: Win/Loss
      basePoints = input.won ? 15 : -8; // Reduced from 25/-10 for stickiness

      // Performance multiplier based on K/D
      const kd = deaths > 0 ? kills / deaths : kills;
      let performanceMultiplier = 1.0;

      if (input.won) {
        // Winning performance bonuses
        if (kd >= 2.0) {
          performanceMultiplier = 1.3; // +30% for excellent performance
          performanceBonus = Math.round(basePoints * 0.3);
        } else if (kd >= 1.5) {
          performanceMultiplier = 1.15; // +15% for good performance
          performanceBonus = Math.round(basePoints * 0.15);
        } else if (kd >= 1.0) {
          performanceMultiplier = 1.0; // Base
        } else if (kd >= 0.7) {
          performanceMultiplier = 0.9; // -10% for below average
          performanceBonus = Math.round(basePoints * -0.1);
        } else {
          performanceMultiplier = 0.8; // -20% for poor performance
          performanceBonus = Math.round(basePoints * -0.2);
        }
      } else {
        // Losing performance penalties (less harsh)
        if (kd >= 1.5) {
          performanceMultiplier = 0.9; // -10% penalty (good performance despite loss)
          performanceBonus = Math.round(basePoints * -0.1);
        } else if (kd >= 1.0) {
          performanceMultiplier = 1.0; // Base loss
        } else if (kd >= 0.5) {
          performanceMultiplier = 1.1; // +10% penalty (poor performance)
          performanceBonus = Math.round(basePoints * 0.1);
        } else {
          performanceMultiplier = 1.2; // +20% penalty (very poor performance)
          performanceBonus = Math.round(basePoints * 0.2);
        }
      }

      // MVP bonuses
      if (input.mvp === true && input.won) {
        mvpBonus = 8; // MVP on win
      } else if (input.mvp === true && !input.won) {
        mvpBonus = 3; // MVP on loss (less but still rewarded)
      }

      // Team MVP bonus (if implemented)
      if (input.teamMVP === true && input.won) {
        teamMVPBonus = 5;
      }

      // Calculate final points with sticky system
      const rawPoints = Math.round(basePoints * performanceMultiplier) + mvpBonus + teamMVPBonus;
    
      // Apply sticky rank system: Harder to gain MMR at higher ranks
      const stickyMultiplier = this.getStickyMultiplier(currentMMR, rawPoints > 0);
      const finalPoints = Math.round(rawPoints * stickyMultiplier);

      return {
        pointsEarned: finalPoints,
        breakdown: {
          basePoints,
          performanceBonus,
          mvpBonus,
          teamMVPBonus,
        },
      };
    } catch (error) {
      console.error('Error calculating match points', {
        input,
        currentMMR,
        error: error instanceof Error ? error.message : String(error),
      });
      // Safe fallback
      return {
        pointsEarned: input.won ? 15 : -8,
        breakdown: {
          basePoints: input.won ? 15 : -8,
          performanceBonus: 0,
          mvpBonus: 0,
          teamMVPBonus: 0,
        },
      };
    }
  }

  /**
   * Get sticky multiplier - makes ranking up harder at higher ranks
   * Makes ranking down easier to prevent demotion anxiety
   */
  private getStickyMultiplier(currentMMR: number, isGain: boolean): number {
    if (isGain) {
      // Harder to gain MMR at higher ranks
      if (currentMMR >= 2800) {
        return 0.6; // CHALLENGER V+ - 40% reduction
      } else if (currentMMR >= 2000) {
        return 0.7; // CHALLENGER - 30% reduction
      } else if (currentMMR >= 1000) {
        return 0.85; // BREAKPOINT - 15% reduction
      } else {
        return 1.0; // GRNDS - Full points
      }
    } else {
      // Easier to lose MMR (but still sticky)
      if (currentMMR >= 2800) {
        return 0.8; // CHALLENGER V+ - 20% reduction in loss
      } else if (currentMMR >= 2000) {
        return 0.85; // CHALLENGER - 15% reduction
      } else if (currentMMR >= 1000) {
        return 0.9; // BREAKPOINT - 10% reduction
      } else {
        return 1.0; // GRNDS - Full loss
      }
    }
  }

  /**
   * Get rank name from MMR
   */
  async getRankFromMMR(mmr: number): Promise<string> {
    try {
      const threshold = await this.dbService.getRankForMMR(mmr);
      if (threshold) {
        return threshold.rank;
      }
      return 'GRNDS I';
    } catch (error) {
      console.error('Error getting rank from MMR', {
        mmr,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'GRNDS I'; // Safe fallback
    }
  }

  /**
   * Get rank value (for sorting/comparison)
   */
  getRankValue(rank: string): number {
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
    return rankMap[rank] || 1;
  }

  /**
   * Calculate initial MMR from Valorant rank with confidence boosting
   * Caps at GRNDS V (800-999 MMR)
   * Follows guardrails: input validation, error handling
   */
  calculateInitialMMR(valorantRank: string, valorantELO: number, lifetimeStats?: {
    wins?: number;
    gamesPlayed?: number;
    peakRank?: string;
  }): number {
    try {
      // Validate inputs
      if (!valorantRank || typeof valorantRank !== 'string') {
        console.warn('Invalid valorantRank, defaulting to Iron 1');
        valorantRank = 'Iron 1';
      }

      if (typeof valorantELO !== 'number' || isNaN(valorantELO)) {
        console.warn('Invalid valorantELO, defaulting to 0');
        valorantELO = 0;
      }
    // Base MMR from Valorant rank (capped at GRNDS V)
    let baseMMR = 0;

    // Map Valorant rank to base MMR (all capped at GRNDS V max)
    const rankMMRMap: Record<string, { min: number; max: number }> = {
      'Iron 1': { min: 0, max: 100 },
      'Iron 2': { min: 100, max: 200 },
      'Iron 3': { min: 200, max: 300 },
      'Bronze 1': { min: 300, max: 400 },
      'Bronze 2': { min: 400, max: 500 },
      'Bronze 3': { min: 500, max: 600 },
      'Silver 1': { min: 600, max: 700 },
      'Silver 2': { min: 700, max: 800 },
      'Silver 3': { min: 800, max: 900 },
      'Gold 1': { min: 800, max: 900 }, // Capped at GRNDS V
      'Gold 2': { min: 800, max: 900 },
      'Gold 3': { min: 800, max: 900 },
      'Platinum 1': { min: 800, max: 900 },
      'Platinum 2': { min: 800, max: 900 },
      'Platinum 3': { min: 800, max: 900 },
      'Diamond 1': { min: 800, max: 900 },
      'Diamond 2': { min: 800, max: 900 },
      'Diamond 3': { min: 800, max: 900 },
      'Ascendant 1': { min: 800, max: 900 },
      'Ascendant 2': { min: 800, max: 900 },
      'Ascendant 3': { min: 800, max: 900 },
      'Immortal 1': { min: 800, max: 900 },
      'Immortal 2': { min: 800, max: 900 },
      'Immortal 3': { min: 800, max: 900 },
      'Radiant': { min: 800, max: 900 },
    };

    const range = rankMMRMap[valorantRank] || { min: 0, max: 200 };
    
    // Use ELO to determine position within range
    const normalizedELO = Math.min(Math.max(valorantELO, 0), 5000);
    const eloPercentage = normalizedELO / 5000;
    baseMMR = range.min + Math.round((range.max - range.min) * eloPercentage);

      // Confidence boosting from lifetime stats
      let confidenceBoost = 0;
      
      if (lifetimeStats) {
        // Validate lifetime stats
        if (typeof lifetimeStats.gamesPlayed === 'number' && lifetimeStats.gamesPlayed > 10) {
          const wins = typeof lifetimeStats.wins === 'number' ? lifetimeStats.wins : 0;
          const winRate = wins / lifetimeStats.gamesPlayed;
          if (winRate > 0.6) {
            confidenceBoost += 50; // High win rate
          } else if (winRate > 0.5) {
            confidenceBoost += 25; // Above average
          }
        }

        // Peak rank boost (if significantly higher than current)
        if (lifetimeStats.peakRank && typeof lifetimeStats.peakRank === 'string') {
          const peakValue = this.getValorantRankValue(lifetimeStats.peakRank);
          const currentValue = this.getValorantRankValue(valorantRank);
          if (peakValue > currentValue + 3) {
            confidenceBoost += 30; // Has been much higher
          }
        }
      }

      // Apply confidence boost (capped at GRNDS V max)
      const finalMMR = Math.min(baseMMR + confidenceBoost, 999);

      return Math.max(0, finalMMR); // Ensure non-negative
    } catch (error) {
      console.error('Error calculating initial MMR', {
        valorantRank,
        valorantELO,
        error: error instanceof Error ? error.message : String(error),
      });
      // Safe fallback - start at GRNDS I
      return 100;
    }
  }

  /**
   * Get numeric value for Valorant rank (for comparison)
   * Follows guardrails: input validation
   */
  getValorantRankValue(rank: string): number {
    if (!rank || typeof rank !== 'string') {
      return 1; // Default to Iron 1
    }

    const rankMap: Record<string, number> = {
      'Iron 1': 1, 'Iron 2': 2, 'Iron 3': 3,
      'Bronze 1': 4, 'Bronze 2': 5, 'Bronze 3': 6,
      'Silver 1': 7, 'Silver 2': 8, 'Silver 3': 9,
      'Gold 1': 10, 'Gold 2': 11, 'Gold 3': 12,
      'Platinum 1': 13, 'Platinum 2': 14, 'Platinum 3': 15,
      'Diamond 1': 16, 'Diamond 2': 17, 'Diamond 3': 18,
      'Ascendant 1': 19, 'Ascendant 2': 20, 'Ascendant 3': 21,
      'Immortal 1': 22, 'Immortal 2': 23, 'Immortal 3': 24,
      'Radiant': 25,
    };
    return rankMap[rank] || 1;
  }

  /**
   * Check and update X rank (top 10 players only)
   * Should be called periodically or after significant MMR changes
   */
  async updateXRank(): Promise<void> {
    try {
      const supabase = this.dbService.supabase;
      if (!supabase) {
        console.warn('Supabase not available for X rank update');
        return;
      }

      // Get top 10 players by MMR
      const { data: topPlayers, error: topError } = await supabase
        .from('players')
        .select('id, discord_user_id, current_mmr, discord_rank')
        .order('current_mmr', { ascending: false })
        .limit(10);

      if (topError) {
        console.error('Error fetching top players', {
          error: topError.message,
        });
        return;
      }

      if (!topPlayers || topPlayers.length === 0) return;

      // Get all players currently with X rank
      const { data: currentXPlayers, error: xError } = await supabase
        .from('players')
        .select('id, discord_user_id, current_mmr')
        .eq('discord_rank', 'X');

      if (xError) {
        console.error('Error fetching X rank players', {
          error: xError.message,
        });
        return;
      }

      const currentXIds = new Set((currentXPlayers || []).map((p: { id: string }) => p.id));
      const newXIds = new Set(topPlayers.map((p: { id: string }) => p.id));

      // Remove X rank from players no longer in top 10
      for (const player of currentXPlayers || []) {
        if (!newXIds.has(player.id)) {
          // Demote to CHALLENGER V
          await this.dbService.updatePlayerRank(
            player.discord_user_id,
            'CHALLENGER V',
            this.getRankValue('CHALLENGER V'),
            player.current_mmr
          );
        }
      }

      // Add X rank to new top 10 players
      for (const player of topPlayers) {
        if (!currentXIds.has((player as { id: string }).id) && player.current_mmr >= 3000) {
          await this.dbService.updatePlayerRank(
            player.discord_user_id,
            'X',
            this.getRankValue('X'),
            player.current_mmr
          );
        }
      }
    } catch (error) {
      console.error('Error updating X rank', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this is a background operation
    }
  }
}
