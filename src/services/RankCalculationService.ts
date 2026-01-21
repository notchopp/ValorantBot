import { DatabaseService } from './DatabaseService';
import { DatabaseMatchPlayerStats } from '../database/supabase';
import { CustomRankService, RankCalculationInput } from './CustomRankService';

export interface RankCalculationResult {
  playerId: string;
  oldMMR: number;
  newMMR: number;
  oldRank: string;
  newRank: string;
  rankChanged: boolean;
  pointsEarned: number;
}

/**
 * Service for calculating rank changes after matches
 */
export class RankCalculationService {
  private dbService: DatabaseService;
  private customRankService: CustomRankService;

  constructor(dbService: DatabaseService, customRankService: CustomRankService) {
    this.dbService = dbService;
    this.customRankService = customRankService;
  }

  /**
   * Calculate MMR changes for all players in a match
   * Follows guardrails: error handling, logging
   */
  async calculateMatchRankChanges(matchId: string): Promise<RankCalculationResult[]> {
    try {
      const supabase = this.dbService.supabase;
      if (!supabase) {
        throw new Error('Database service not initialized');
      }
      
      // Get match
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (matchError || !match) {
        console.error('Match not found', {
          matchId,
          error: matchError?.message,
        });
        throw new Error('Match not found');
      }

      const matchGame: 'valorant' | 'marvel_rivals' =
        match.match_type === 'marvel_rivals' ? 'marvel_rivals' : 'valorant';

      // Get all player stats for this match
      const { data: playerStats, error: statsError } = await supabase
        .from('match_player_stats')
        .select('*')
        .eq('match_id', match.id);

      if (statsError) {
        console.error('Error fetching player stats', {
          matchId,
          error: statsError.message,
        });
        throw new Error('Failed to fetch player stats');
      }

      if (!playerStats || playerStats.length === 0) {
        throw new Error('No player stats found for match');
      }

    const results: RankCalculationResult[] = [];

    const teamAStats = playerStats.filter((stat) => stat.team === 'A');
    const teamBStats = playerStats.filter((stat) => stat.team === 'B');
    const teamAAvg = this.getTeamAverageMMR(teamAStats);
    const teamBAvg = this.getTeamAverageMMR(teamBStats);
    const expectedA = this.getExpectedScore(teamAAvg, teamBAvg);
    const expectedB = 1 - expectedA;

    for (const stat of playerStats) {
      // Get current player data
      const player = await this.dbService.getPlayer(stat.player_id);
      if (!player) continue;

      // Get old MMR from stat
      const oldMMR = stat.mmr_before ?? (matchGame === 'marvel_rivals'
        ? (player.marvel_rivals_mmr || 0)
        : (player.valorant_mmr || player.current_mmr || 0));

      // Calculate points earned using custom rank system
      const expectedScore = stat.team === 'A' ? expectedA : expectedB;
      const pointsEarned = this.calculatePoints(stat, match.winner === stat.team, oldMMR, expectedScore);

      // Calculate new MMR
      const newMMR = oldMMR + pointsEarned;

      // Determine new rank using custom rank system
      const oldRank = matchGame === 'marvel_rivals'
        ? (player.marvel_rivals_rank || 'Unranked')
        : (player.valorant_rank || player.discord_rank || 'Unranked');
      const newRank = await this.customRankService.getRankFromMMR(newMMR);
      const newRankValue = this.customRankService.getRankValue(newRank);

      // Update player MMR and rank in database
      await this.dbService.updatePlayerRank(player.discord_user_id, newRank, newRankValue, newMMR, matchGame);

      const rankChanged = oldRank !== newRank;

      // Log rank change if it changed
      if (rankChanged) {
        await this.dbService.logRankChange(
          player.id,
          oldRank,
          newRank,
          oldMMR,
          newMMR,
          'match',
          match.id
        );
      }

      results.push({
        playerId: player.discord_user_id,
        oldMMR,
        newMMR,
        oldRank,
        newRank,
        rankChanged,
        pointsEarned,
      });

      // Update match_player_stats with final MMR
      await supabase
        .from('match_player_stats')
        .update({
          mmr_after: newMMR,
          points_earned: pointsEarned,
        })
        .eq('id', stat.id);
    }

      return results;
    } catch (error) {
      console.error('Error calculating match rank changes', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Calculate points earned based on match performance
   * Uses CustomRankService for sticky rank system
   */
  private calculatePoints(stat: DatabaseMatchPlayerStats, won: boolean, currentMMR: number, expectedScore: number): number {
    try {
      const input: RankCalculationInput = {
        won,
        kills: stat.kills,
        deaths: stat.deaths,
        assists: stat.assists,
        mvp: stat.mvp,
        damage: stat.damage,
        score: stat.score,
        expectedScore,
      };

      const result = this.customRankService.calculateMatchPoints(input, currentMMR);
      return result.pointsEarned;
    } catch (error) {
      console.error('Error calculating points', {
        statId: stat.id,
        won,
        currentMMR,
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to simple calculation
      return won ? 15 : -8;
    }
  }

  private getTeamAverageMMR(stats: DatabaseMatchPlayerStats[]): number {
    if (!stats.length) {
      return 0;
    }
    const total = stats.reduce((sum, stat) => sum + (stat.mmr_before || 0), 0);
    return Math.round(total / stats.length);
  }

  private getExpectedScore(teamMMR: number, opponentMMR: number): number {
    const exponent = (opponentMMR - teamMMR) / 400;
    return 1 / (1 + Math.pow(10, exponent));
  }

  /**
   * Get rank progression info (current rank, MMR, progress to next rank)
   * Follows guardrails: error handling, null checks
   */
  async getRankProgression(
    discordUserId: string,
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<{
    currentRank: string;
    currentMMR: number;
    nextRank?: string;
    nextRankMMR: number;
    progressToNext: number; // Percentage (0-100)
    mmrNeeded: number;
  } | null> {
    try {
      const player = await this.dbService.getPlayer(discordUserId);
      if (!player) {
        return null;
      }

    const thresholds = await this.dbService.getAllRankThresholds();
    const currentMMR = game === 'marvel_rivals'
      ? (player.marvel_rivals_mmr || 0)
      : (player.valorant_mmr || player.current_mmr || 0);
    const currentRank = game === 'marvel_rivals'
      ? (player.marvel_rivals_rank || 'Unranked')
      : (player.valorant_rank || player.discord_rank || 'Unranked');

    const currentThreshold = thresholds.find(
      t => t.min_mmr <= currentMMR && currentMMR <= t.max_mmr
    );

    if (!currentThreshold) {
      return {
        currentRank,
        currentMMR,
        nextRankMMR: 0,
        progressToNext: 0,
        mmrNeeded: 0,
      };
    }

    // Find next rank
    const currentIndex = thresholds.findIndex(t => t.rank === currentThreshold.rank);
    const nextThreshold = currentIndex < thresholds.length - 1
      ? thresholds[currentIndex + 1]
      : null;

    if (!nextThreshold) {
      // Already at max rank (Radiant)
      return {
        currentRank: currentThreshold.rank,
        currentMMR,
        nextRank: undefined,
        nextRankMMR: currentThreshold.max_mmr,
        progressToNext: 100,
        mmrNeeded: 0,
      };
    }

    const mmrInCurrentRank = currentMMR - currentThreshold.min_mmr;
    const mmrRange = currentThreshold.max_mmr - currentThreshold.min_mmr;
    const progressToNext = mmrRange > 0
      ? Math.round((mmrInCurrentRank / mmrRange) * 100)
      : 0;
    const mmrNeeded = nextThreshold.min_mmr - currentMMR;

      return {
        currentRank: currentThreshold.rank,
        currentMMR,
        nextRank: nextThreshold.rank,
        nextRankMMR: nextThreshold.min_mmr,
        progressToNext,
        mmrNeeded,
      };
    } catch (error) {
      console.error('Error getting rank progression', {
        discordUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null; // Safe fallback
    }
  }
}
