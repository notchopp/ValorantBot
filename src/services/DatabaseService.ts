import { supabase as supabaseClient, DatabasePlayer, DatabaseMatch, DatabaseMatchPlayerStats, DatabaseRankThreshold, DatabaseQueue } from '../database/supabase';
import { Player, createPlayer } from '../models/Player';

export class DatabaseService {
  // Expose supabase for rank calculation service
  get supabase() {
    return supabaseClient;
  }

  private getSupabase() {
    if (!supabaseClient) {
      throw new Error('Supabase not initialized. Check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
    return supabaseClient;
  }
  /**
   * Get or create a player in the database
   */
  async getOrCreatePlayer(discordUserId: string, discordUsername: string): Promise<DatabasePlayer | null> {
    const supabase = this.getSupabase();

    // Try to get existing player
    const { data: existing, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .eq('discord_user_id', discordUserId)
      .single();

    if (existing && !fetchError) {
      // Update username if changed
      if (existing.discord_username !== discordUsername) {
        const { data: updated } = await supabase
          .from('players')
          .update({ discord_username: discordUsername })
          .eq('discord_user_id', discordUserId)
          .select()
          .single();
        return updated;
      }
      return existing;
    }

    // Create new player
    const { data: newPlayer, error: createError } = await supabase
      .from('players')
      .insert({
        discord_user_id: discordUserId,
        discord_username: discordUsername,
        discord_rank: 'Unranked',
        discord_rank_value: 0,
        discord_mmr: 0,
        current_mmr: 0,
        peak_mmr: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating player:', createError);
      return null;
    }

    return newPlayer;
  }

  /**
   * Get player by Discord user ID
   */
  async getPlayer(discordUserId: string): Promise<DatabasePlayer | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('discord_user_id', discordUserId)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Update player's Riot ID information
   */
  async updatePlayerRiotID(
    discordUserId: string,
    riotName: string,
    riotTag: string,
    riotPUUID: string,
    region: string
  ): Promise<boolean> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from('players')
      .update({
        riot_name: riotName,
        riot_tag: riotTag,
        riot_puuid: riotPUUID,
        riot_region: region,
        verified_at: new Date().toISOString(),
      })
      .eq('discord_user_id', discordUserId);

    return !error;
  }

  /**
   * Update player's Discord rank and MMR
   */
  async updatePlayerRank(
    discordUserId: string,
    rank: string,
    rankValue: number,
    mmr: number
  ): Promise<boolean> {
    const supabase = this.getSupabase();

    const player = await this.getPlayer(discordUserId);
    if (!player) return false;

    const updateData: any = {
      discord_rank: rank,
      discord_rank_value: rankValue,
      current_mmr: mmr,
    };

    // Update peak MMR if higher
    if (mmr > player.peak_mmr) {
      updateData.peak_mmr = mmr;
    }

    const { error } = await supabase
      .from('players')
      .update(updateData)
      .eq('discord_user_id', discordUserId);

    return !error;
  }

  /**
   * Update player MMR (used after matches)
   */
  async updatePlayerMMR(discordUserId: string, newMMR: number): Promise<boolean> {
    const supabase = this.getSupabase();

    const player = await this.getPlayer(discordUserId);
    if (!player) return false;

    // Determine rank from MMR
    const rankThreshold = await this.getRankForMMR(newMMR);
    
    const updateData: any = {
      current_mmr: newMMR,
    };

    if (rankThreshold) {
      updateData.discord_rank = rankThreshold.rank;
      updateData.discord_rank_value = this.getRankValue(rankThreshold.rank);
    }

    // Update peak MMR if higher
    if (newMMR > player.peak_mmr) {
      updateData.peak_mmr = newMMR;
    }

    // Check if rank changed
    const rankChanged = rankThreshold && player.discord_rank !== rankThreshold.rank;

    const { error } = await supabase
      .from('players')
      .update(updateData)
      .eq('discord_user_id', discordUserId);

    // Log rank history if rank changed
    if (rankChanged && !error) {
      await this.logRankChange(
        player.id,
        player.discord_rank,
        rankThreshold!.rank,
        player.current_mmr,
        newMMR,
        'match'
      );
    }

    return !error;
  }

  /**
   * Get rank threshold for given MMR
   */
  async getRankForMMR(mmr: number): Promise<DatabaseRankThreshold | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from('rank_thresholds')
      .select('*')
      .lte('min_mmr', mmr)
      .gte('max_mmr', mmr)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Get all rank thresholds
   */
  async getAllRankThresholds(): Promise<DatabaseRankThreshold[]> {
    const supabase = this.getSupabase();
    const { data } = await supabase
      .from('rank_thresholds')
      .select('*')
      .order('min_mmr', { ascending: true });

    return data || [];
  }

  /**
   * Log rank change to history
   */
  async logRankChange(
    playerId: string,
    oldRank: string,
    newRank: string,
    oldMMR: number,
    newMMR: number,
    reason: 'match' | 'verification' | 'adjustment',
    matchId?: string
  ): Promise<boolean> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from('rank_history')
      .insert({
        player_id: playerId,
        old_rank: oldRank,
        new_rank: newRank,
        old_mmr: oldMMR,
        new_mmr: newMMR,
        reason,
        match_id: matchId || null,
      });

    return !error;
  }

  /**
   * Get top players by MMR
   */
  async getTopPlayers(limit: number = 10): Promise<DatabasePlayer[]> {
    const supabase = this.getSupabase();
    const { data } = await supabase
      .from('players')
      .select('*')
      .order('current_mmr', { ascending: false })
      .limit(limit);

    return data || [];
  }

  /**
   * Convert database player to model player
   */
  databasePlayerToModel(dbPlayer: DatabasePlayer): Player {
    const player = createPlayer(dbPlayer.discord_user_id, dbPlayer.discord_username);
    player.rank = dbPlayer.discord_rank !== 'Unranked' ? dbPlayer.discord_rank : undefined;
    player.rankValue = dbPlayer.discord_rank_value > 0 ? dbPlayer.discord_rank_value : undefined;
    
    if (dbPlayer.riot_name && dbPlayer.riot_tag) {
      player.riotId = {
        name: dbPlayer.riot_name,
        tag: dbPlayer.riot_tag,
        region: dbPlayer.riot_region || undefined,
      };
    }

    // Convert MMR to stats points (for compatibility)
    player.stats.points = dbPlayer.current_mmr;
    // Note: Games played, wins, losses should be calculated from matches

    return player;
  }

  /**
   * Create a match in the database
   */
  async createMatch(match: {
    matchId: string;
    map: string;
    hostUserId: string;
    teamA: string[]; // Array of Discord user IDs
    teamB: string[]; // Array of Discord user IDs
    matchType?: 'custom' | 'valorant';
  }): Promise<DatabaseMatch | null> {
    try {
      const supabase = this.getSupabase();

      // Get host player ID
      const hostPlayer = await this.getPlayer(match.hostUserId);
      if (!hostPlayer) {
        console.error('Host player not found', { hostUserId: match.hostUserId });
        return null;
      }

      // Convert team arrays to JSONB
      const teamAJson = JSON.stringify(match.teamA);
      const teamBJson = JSON.stringify(match.teamB);

      const { data, error } = await supabase
        .from('matches')
        .insert({
          match_id: match.matchId,
          match_type: match.matchType || 'custom',
          map: match.map,
          host_id: hostPlayer.id,
          team_a: teamAJson,
          team_b: teamBJson,
          status: 'in-progress',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating match', {
          matchId: match.matchId,
          error: error.message,
        });
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating match', {
        matchId: match.matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update match (winner, score, status)
   */
  async updateMatch(
    matchId: string,
    updates: {
      winner?: 'A' | 'B';
      score?: { teamA: number; teamB: number };
      status?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
    }
  ): Promise<boolean> {
    try {
      const supabase = this.getSupabase();

      const updateData: any = {};
      if (updates.winner) updateData.winner = updates.winner;
      if (updates.score) updateData.score = JSON.stringify(updates.score);
      if (updates.status) {
        updateData.status = updates.status;
        if (updates.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('match_id', matchId);

      if (error) {
        console.error('Error updating match', {
          matchId,
          error: error.message,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating match', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get match by match_id
   */
  async getMatch(matchId: string): Promise<DatabaseMatch | null> {
    try {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('match_id', matchId)
        .single();

      if (error || !data) return null;
      return data;
    } catch (error) {
      console.error('Error getting match', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create match player stats
   */
  async createMatchPlayerStats(
    matchId: string,
    playerUserId: string,
    stats: {
      team: 'A' | 'B';
      kills: number;
      deaths: number;
      assists?: number;
      mvp?: boolean;
      damage?: number;
      score?: number;
      mmrBefore: number;
    }
  ): Promise<DatabaseMatchPlayerStats | null> {
    try {
      const supabase = this.getSupabase();

      // Get match and player IDs
      const match = await this.getMatch(matchId);
      if (!match) {
        console.error('Match not found', { matchId });
        return null;
      }

      const player = await this.getPlayer(playerUserId);
      if (!player) {
        console.error('Player not found', { playerUserId });
        return null;
      }

      const { data, error } = await supabase
        .from('match_player_stats')
        .insert({
          match_id: match.id,
          player_id: player.id,
          team: stats.team,
          kills: stats.kills,
          deaths: stats.deaths,
          assists: stats.assists || 0,
          mvp: stats.mvp || false,
          damage: stats.damage || 0,
          score: stats.score || 0,
          mmr_before: stats.mmrBefore,
          mmr_after: stats.mmrBefore, // Will be updated after rank calculation
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating match player stats', {
          matchId,
          playerUserId,
          error: error.message,
        });
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error creating match player stats', {
        matchId,
        playerUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get match player stats for a match
   */
  async getMatchPlayerStats(matchId: string): Promise<DatabaseMatchPlayerStats[]> {
    try {
      const supabase = this.getSupabase();
      const match = await this.getMatch(matchId);
      if (!match) return [];

      const { data, error } = await supabase
        .from('match_player_stats')
        .select('*')
        .eq('match_id', match.id);

      if (error) {
        console.error('Error getting match player stats', {
          matchId,
          error: error.message,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting match player stats', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Add player to queue
   */
  async addPlayerToQueue(playerUserId: string): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const player = await this.getPlayer(playerUserId);
      if (!player) {
        console.error('Player not found for queue', { playerUserId });
        return false;
      }

      // Check if already in queue
      const { data: existing } = await supabase
        .from('queue')
        .select('id')
        .eq('player_id', player.id)
        .single();

      if (existing) {
        // Already in queue
        return false;
      }

      // Add to queue
      const { error } = await supabase
        .from('queue')
        .insert({
          player_id: player.id,
          joined_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error adding player to queue', {
          playerUserId,
          error: error.message,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding player to queue', {
        playerUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Remove player from queue
   */
  async removePlayerFromQueue(playerUserId: string): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const player = await this.getPlayer(playerUserId);
      if (!player) {
        return false;
      }

      const { error } = await supabase
        .from('queue')
        .delete()
        .eq('player_id', player.id);

      if (error) {
        console.error('Error removing player from queue', {
          playerUserId,
          error: error.message,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing player from queue', {
        playerUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get all players in queue
   */
  async getQueuePlayers(): Promise<DatabaseQueue[]> {
    try {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('queue')
        .select('*')
        .order('joined_at', { ascending: true });

      if (error) {
        console.error('Error getting queue players', {
          error: error.message,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting queue players', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Clear all players from queue
   */
  async clearQueue(): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const { error } = await supabase
        .from('queue')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) {
        console.error('Error clearing queue', {
          error: error.message,
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error clearing queue', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Helper: Get rank value from rank name
   */
  private getRankValue(rank: string): number {
    const rankMap: Record<string, number> = {
      'Unranked': 0,
      'Iron': 1,
      'Bronze': 2,
      'Silver': 3,
      'Gold': 4,
      'Platinum': 5,
      'Diamond': 6,
      'Ascendant': 7,
      'Immortal': 8,
      'Radiant': 9,
    };
    return rankMap[rank] || 0;
  }
}
