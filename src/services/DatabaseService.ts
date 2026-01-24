import { supabase as supabaseClient, DatabasePlayer, DatabaseMatch, DatabaseMatchPlayerStats, DatabaseRankThreshold, DatabaseQueue } from '../database/supabase';
import { Player, createPlayer } from '../models/Player';
import { randomUUID } from 'crypto';

export class DatabaseService {
  // Expose supabase for rank calculation service
  get supabase() {
    return supabaseClient;
  }

  private getSupabase() {
    if (!supabaseClient) {
      throw new Error('Supabase not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) environment variables.');
    }
    return supabaseClient;
  }
  /**
   * Get player by Riot ID (name and tag)
   */
  async getPlayerByRiotID(riotName: string, riotTag: string): Promise<DatabasePlayer | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('riot_name', riotName)
      .eq('riot_tag', riotTag)
      .single();

    if (error || !data) return null;
    return data;
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
    // Note: id must be a UUID (migration 008 changed id to auth UID, but bot generates UUIDs)
    const { data: newPlayer, error: createError } = await supabase
      .from('players')
      .insert({
        id: randomUUID(), // Generate UUID for bot-created players (not using Supabase auth)
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
   * Ensures player exists first, then updates - prevents null id constraint violations
   */
  async updatePlayerRiotID(
    discordUserId: string,
    riotName: string,
    riotTag: string,
    riotPUUID: string,
    region: string
  ): Promise<boolean> {
    const supabase = this.getSupabase();
    
    // First, ensure player exists in database (prevents null id errors)
    const existingPlayer = await this.getPlayer(discordUserId);
    if (!existingPlayer) {
      // Player doesn't exist - create them first with minimal required data
      // Note: id must be a UUID (migration 008 changed id to auth UID, but bot generates UUIDs)
      const { error: createError } = await supabase
        .from('players')
        .insert({
          id: randomUUID(), // Generate UUID for bot-created players (not using Supabase auth)
          discord_user_id: discordUserId,
          discord_username: 'Unknown', // Will be updated on next sync
          discord_rank: 'Unranked',
          discord_rank_value: 0,
          discord_mmr: 0,
          current_mmr: 0,
          peak_mmr: 0,
        });

      if (createError) {
        console.error('Error creating player for Riot ID update:', {
          discordUserId,
          error: createError.message,
          code: createError.code,
          details: createError.details,
        });
        return false;
      }
    }

    // Now update their Riot ID (player definitely exists now)
    const { error: updateError } = await supabase
      .from('players')
      .update({
        riot_name: riotName,
        riot_tag: riotTag,
        riot_puuid: riotPUUID,
        riot_region: region,
        verified_at: new Date().toISOString(),
      })
      .eq('discord_user_id', discordUserId);

    if (updateError) {
      console.error('Error updating player Riot ID:', {
        discordUserId,
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
      });
      return false;
    }

    return true;
  }

  /**
   * Update player's Marvel Rivals account info
   */
  async updatePlayerMarvelRivalsID(
    discordUserId: string,
    uid: string,
    username: string
  ): Promise<boolean> {
    const supabase = this.getSupabase();

    const existingPlayer = await this.getPlayer(discordUserId);
    if (!existingPlayer) {
      const { error: createError } = await supabase
        .from('players')
        .insert({
          id: randomUUID(),
          discord_user_id: discordUserId,
          discord_username: 'Unknown',
          discord_rank: 'Unranked',
          discord_rank_value: 0,
          discord_mmr: 0,
          current_mmr: 0,
          peak_mmr: 0,
        });

      if (createError) {
        console.error('Error creating player for Marvel Rivals update:', {
          discordUserId,
          error: createError.message,
          code: createError.code,
          details: createError.details,
        });
        return false;
      }
    }

    const { error: updateError } = await supabase
      .from('players')
      .update({
        marvel_rivals_uid: uid,
        marvel_rivals_username: username,
        verified_at: new Date().toISOString(),
      })
      .eq('discord_user_id', discordUserId);

    if (updateError) {
      console.error('Error updating player Marvel Rivals ID:', {
        discordUserId,
        error: updateError.message,
        code: updateError.code,
        details: updateError.details,
      });
      return false;
    }

    return true;
  }

  /**
   * Unlink/clear Riot ID from a player in the database
   * Also clears Valorant rank and MMR so user can re-verify
   */
  async unlinkPlayerRiotID(discordUserId: string): Promise<boolean> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from('players')
      .update({
        riot_name: null,
        riot_tag: null,
        riot_puuid: null,
        riot_region: null,
        verified_at: null,
        valorant_rank: null,
        valorant_mmr: null,
        valorant_peak_mmr: null,
      })
      .eq('discord_user_id', discordUserId);

    return !error;
  }

  /**
   * Unlink/clear Marvel Rivals account from a player in the database
   * Also clears Marvel Rivals rank and MMR so user can re-verify
   */
  async unlinkPlayerMarvelRivalsID(discordUserId: string): Promise<boolean> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from('players')
      .update({
        marvel_rivals_uid: null,
        marvel_rivals_username: null,
        marvel_rivals_rank: null,
        marvel_rivals_mmr: null,
        marvel_rivals_peak_mmr: null,
      })
      .eq('discord_user_id', discordUserId);

    return !error;
  }

  /**
   * Set player's preferred game
   */
  async setPlayerPreferredGame(discordUserId: string, game: 'valorant' | 'marvel_rivals'): Promise<boolean> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from('players')
      .update({ preferred_game: game })
      .eq('discord_user_id', discordUserId);
    return !error;
  }

  /**
   * Set player's primary game for role assignment
   */
  async setPlayerPrimaryGame(discordUserId: string, game: 'valorant' | 'marvel_rivals'): Promise<boolean> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from('players')
      .update({ primary_game: game })
      .eq('discord_user_id', discordUserId);
    return !error;
  }

  /**
   * Set player's role mode (highest or primary)
   */
  async setPlayerRoleMode(discordUserId: string, mode: 'highest' | 'primary'): Promise<boolean> {
    const supabase = this.getSupabase();
    const { error } = await supabase
      .from('players')
      .update({ role_mode: mode })
      .eq('discord_user_id', discordUserId);
    return !error;
  }

  /**
   * Get player by Marvel Rivals UID
   */
  async getPlayerByMarvelRivalsUID(uid: string): Promise<DatabasePlayer | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('marvel_rivals_uid', uid)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Get player by Marvel Rivals username (case-insensitive)
   */
  async getPlayerByMarvelRivalsUsername(username: string): Promise<DatabasePlayer | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .ilike('marvel_rivals_username', username)
      .single();

    if (error || !data) return null;
    return data;
  }

  /**
   * Update player's Discord rank and MMR
   */
  async updatePlayerRank(
    discordUserId: string,
    rank: string,
    rankValue: number,
    mmr: number,
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<boolean> {
    const supabase = this.getSupabase();

    const player = await this.getPlayer(discordUserId);
    if (!player) return false;

    const updateData: any = this.getGameRankUpdate(game, rank, rankValue, mmr);

    // Update peak MMR if higher (game-specific)
    if (game === 'valorant') {
      const currentPeak = player.valorant_peak_mmr || 0;
      if (mmr > currentPeak) {
        updateData.valorant_peak_mmr = mmr;
      }
    } else {
      const currentPeak = player.marvel_rivals_peak_mmr || 0;
      if (mmr > currentPeak) {
        updateData.marvel_rivals_peak_mmr = mmr;
      }
    }

    const combinedUpdate = this.getCombinedRankUpdate(player, updateData);
    Object.assign(updateData, combinedUpdate);

    if (updateData.current_mmr > player.peak_mmr) {
      updateData.peak_mmr = updateData.current_mmr;
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
  async updatePlayerMMR(
    discordUserId: string,
    newMMR: number,
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<boolean> {
    const supabase = this.getSupabase();

    const player = await this.getPlayer(discordUserId);
    if (!player) return false;

    // Determine rank from MMR
    const rankThreshold = await this.getRankForMMR(newMMR);
    
    const updateData: any = this.getGameRankUpdate(game, rankThreshold?.rank || 'Unranked', this.getRankValue(rankThreshold?.rank || 'Unranked'), newMMR);

    if (rankThreshold) {
      const gameUpdate = this.getGameRankUpdate(
        game,
        rankThreshold.rank,
        this.getRankValue(rankThreshold.rank),
        newMMR
      );
      Object.assign(updateData, gameUpdate);
    }

    // Update peak MMR if higher
    if (game === 'valorant') {
      const currentPeak = player.valorant_peak_mmr || 0;
      if (newMMR > currentPeak) {
        updateData.valorant_peak_mmr = newMMR;
      }
    } else {
      const currentPeak = player.marvel_rivals_peak_mmr || 0;
      if (newMMR > currentPeak) {
        updateData.marvel_rivals_peak_mmr = newMMR;
      }
    }

    const combinedUpdate = this.getCombinedRankUpdate(player, updateData);
    Object.assign(updateData, combinedUpdate);

    if (updateData.current_mmr > player.peak_mmr) {
      updateData.peak_mmr = updateData.current_mmr;
    }

    // Check if rank changed
    const rankChanged = rankThreshold && player.discord_rank !== updateData.discord_rank;

    const { error } = await supabase
      .from('players')
      .update(updateData)
      .eq('discord_user_id', discordUserId);

    // Log rank history if rank changed
    if (rankChanged && !error) {
      await this.logRankChange(
        player.id,
        player.discord_rank,
        updateData.discord_rank,
        player.current_mmr,
        updateData.current_mmr,
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
    player.preferredGame = dbPlayer.preferred_game || 'valorant';
    player.primaryGame = dbPlayer.primary_game || 'valorant';
    player.roleMode = dbPlayer.role_mode || 'highest';
    player.valorantRank = dbPlayer.valorant_rank || dbPlayer.discord_rank || undefined;
    player.valorantRankValue = dbPlayer.valorant_rank_value || dbPlayer.discord_rank_value || undefined;
    player.valorantMMR = dbPlayer.valorant_mmr || dbPlayer.current_mmr || undefined;
    player.valorantPeakMMR = dbPlayer.valorant_peak_mmr || dbPlayer.peak_mmr || undefined;
    player.marvelRivalsRank = dbPlayer.marvel_rivals_rank || undefined;
    player.marvelRivalsRankValue = dbPlayer.marvel_rivals_rank_value || undefined;
    player.marvelRivalsMMR = dbPlayer.marvel_rivals_mmr || undefined;
    player.marvelRivalsPeakMMR = dbPlayer.marvel_rivals_peak_mmr || undefined;
    
    if (dbPlayer.riot_name && dbPlayer.riot_tag) {
      player.riotId = {
        name: dbPlayer.riot_name,
        tag: dbPlayer.riot_tag,
        region: dbPlayer.riot_region || undefined,
        puuid: dbPlayer.riot_puuid || undefined,
      };
    }
    if (dbPlayer.marvel_rivals_uid && dbPlayer.marvel_rivals_username) {
      player.marvelRivalsId = {
        uid: dbPlayer.marvel_rivals_uid,
        username: dbPlayer.marvel_rivals_username,
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
    matchType?: 'custom' | 'valorant' | 'marvel_rivals';
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
          host_user_id: match.hostUserId, // Store Discord user ID for easy lookup
          team_a: teamAJson,
          team_b: teamBJson,
          status: 'pending', // Start as pending until host confirms
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
      host_user_id?: string;
      host_invite_code?: string | null;
      host_confirmed?: boolean;
      host_selected_at?: string | null;
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
      if (updates.host_user_id !== undefined) updateData.host_user_id = updates.host_user_id;
      if (updates.host_invite_code !== undefined) updateData.host_invite_code = updates.host_invite_code;
      if (updates.host_confirmed !== undefined) updateData.host_confirmed = updates.host_confirmed;
      if (updates.host_selected_at !== undefined) updateData.host_selected_at = updates.host_selected_at;

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
   * Get active match for a user (pending or in-progress where user is a participant or host)
   */
  async getActiveMatchForUser(userId: string): Promise<DatabaseMatch | null> {
    try {
      const supabase = this.getSupabase();
      
      // First try to find match where user is host
      const { data: hostMatch } = await supabase
        .from('matches')
        .select('*')
        .eq('host_user_id', userId)
        .in('status', ['pending', 'in-progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (hostMatch) return hostMatch;

      // If not host, find any active match where user is in team_a or team_b
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['pending', 'in-progress'])
        .order('created_at', { ascending: false });

      if (matchError || !matches) return null;

      // Check if user is in any team
      for (const match of matches) {
        const teamA = match.team_a as string[];
        const teamB = match.team_b as string[];
        if (teamA?.includes(userId) || teamB?.includes(userId)) {
          return match;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting active match for user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get any active match (pending or in-progress)
   */
  async getAnyActiveMatch(): Promise<DatabaseMatch | null> {
    try {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['pending', 'in-progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('Error getting any active match', {
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
  async addPlayerToQueue(
    playerUserId: string,
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<boolean> {
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
        .eq('game', game)
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
          game,
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
  async removePlayerFromQueue(
    playerUserId: string,
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const player = await this.getPlayer(playerUserId);
      if (!player) {
        return false;
      }

      const { error } = await supabase
        .from('queue')
        .delete()
        .eq('player_id', player.id)
        .eq('game', game);

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
  async getQueuePlayers(
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<DatabaseQueue[]> {
    try {
      const supabase = this.getSupabase();
      const { data, error } = await supabase
        .from('queue')
        .select('*')
        .eq('game', game)
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
   * Get queue players with their player data (rank, MMR, etc.)
   */
  async getQueuePlayersWithData(
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<DatabasePlayer[]> {
    try {
      const supabase = this.getSupabase();
      
      // First get queue entries
      const { data: queueEntries, error: queueError } = await supabase
        .from('queue')
        .select('player_id')
        .eq('game', game)
        .order('joined_at', { ascending: true });

      if (queueError || !queueEntries || queueEntries.length === 0) {
        return [];
      }

      // Get player IDs
      const playerIds = queueEntries.map((entry) => entry.player_id);

      // Get player data for all queued players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .in('id', playerIds);

      if (playersError) {
        console.error('Error getting queue players with data', {
          error: playersError.message,
        });
        return [];
      }

      // Sort players by their order in the queue
      const playerMap = new Map(players?.map((p) => [p.id, p]) || []);
      const sortedPlayers = queueEntries
        .map((entry) => playerMap.get(entry.player_id))
        .filter((p): p is DatabasePlayer => p !== undefined);

      return sortedPlayers;
    } catch (error) {
      console.error('Error getting queue players with data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Clear all players from queue
   */
  async clearQueue(
    game: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Promise<boolean> {
    try {
      const supabase = this.getSupabase();
      const { error } = await supabase
        .from('queue')
        .delete()
        .eq('game', game);

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
   * Get rank history for a player
   */
  async getRankHistory(discordUserId: string, limit: number = 10): Promise<Array<{
    old_rank: string;
    new_rank: string;
    old_mmr: number;
    new_mmr: number;
    reason: string;
    created_at: string;
  }> | null> {
    try {
      const supabase = this.getSupabase();
      const player = await this.getPlayer(discordUserId);
      if (!player) {
        return null;
      }

      const { data, error } = await supabase
        .from('rank_history')
        .select('old_rank, new_rank, old_mmr, new_mmr, reason, created_at')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error getting rank history', {
          discordUserId,
          error: error.message,
        });
        return null;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting rank history', {
        discordUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get recent match summary stats for profile cards
   */
  async getPlayerMatchSummary(
    discordUserId: string,
    options: {
      limit?: number;
      recentLimit?: number;
      matchTypes?: string[];
    } = {}
  ): Promise<{
    stats: {
      wins: number;
      losses: number;
      winrate: string;
      kills: number;
      deaths: number;
      kd: string;
      mvp: number;
      svp: number;
      games: number;
    };
    recentGames: Array<{
      title: string;
      meta: string;
      result: 'win' | 'loss';
      mmrChange: string;
    }>;
  } | null> {
    try {
      const supabase = this.getSupabase();
      const player = await this.getPlayer(discordUserId);
      if (!player) {
        return null;
      }

      const limit = options.limit ?? 25;
      const recentLimit = options.recentLimit ?? 5;

      let query = supabase
        .from('match_player_stats')
        .select(`
          mmr_before,
          mmr_after,
          team,
          kills,
          deaths,
          assists,
          mvp,
          matches!inner(
            match_id,
            match_date,
            map,
            winner,
            status,
            match_type
          )
        `)
        .eq('player_id', player.id)
        .eq('matches.status', 'completed')
        .order('matches(match_date)', { ascending: false })
        .limit(limit);

      if (options.matchTypes && options.matchTypes.length > 0) {
        query = query.in('matches.match_type', options.matchTypes);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.error('Error getting match summary', {
          discordUserId,
          error,
        });
        return null;
      }

      const totalGames = data.length;
      const wins = data.filter((stat: any) => stat.matches.winner === stat.team).length;
      const losses = totalGames - wins;
      const kills = data.reduce((sum: number, stat: any) => sum + (stat.kills || 0), 0);
      const deaths = data.reduce((sum: number, stat: any) => sum + (stat.deaths || 0), 0);
      const mvp = data.filter((stat: any) => stat.mvp).length;
      const kdValue = deaths > 0 ? kills / deaths : kills;

      const stats = {
        wins,
        losses,
        winrate: totalGames > 0 ? `${((wins / totalGames) * 100).toFixed(1)}%` : '0%',
        kills,
        deaths,
        kd: kdValue.toFixed(2),
        mvp,
        svp: 0,
        games: totalGames,
      };

      const recentGames = data.slice(0, recentLimit).map((stat: any) => {
        const won = stat.matches.winner === stat.team;
        const result = (won ? 'win' : 'loss') as 'win' | 'loss';
        const mmrChange = (stat.mmr_after || 0) - (stat.mmr_before || 0);
        const date = new Date(stat.matches.match_date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const meta = `${dateStr} • K/D/A ${stat.kills}/${stat.deaths}/${stat.assists}`;
        return {
          title: stat.matches.map,
          meta,
          result,
          mmrChange: `${mmrChange >= 0 ? '+' : ''}${mmrChange}`,
        };
      });

      return {
        stats,
        recentGames,
      };
    } catch (error) {
      console.error('Error getting match summary', {
        discordUserId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Helper: Get rank value from rank name
   */
  private getRankValue(rank: string): number {
    const rankMap: Record<string, number> = {
      'Unranked': 0,
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
      'ABSOLUTE': 14,
      'X': 15,
    };
    return rankMap[rank] || 0;
  }

  private getGameRankUpdate(
    game: 'valorant' | 'marvel_rivals',
    rank: string,
    rankValue: number,
    mmr: number
  ): Record<string, unknown> {
    if (game === 'marvel_rivals') {
      return {
        marvel_rivals_rank: rank,
        marvel_rivals_rank_value: rankValue,
        marvel_rivals_mmr: mmr,
      };
    }
    return {
      valorant_rank: rank,
      valorant_rank_value: rankValue,
      valorant_mmr: mmr,
      discord_rank: rank,
      discord_rank_value: rankValue,
      current_mmr: mmr,
    };
  }

  private getCombinedRankUpdate(
    player: DatabasePlayer,
    updates: Record<string, unknown>
  ): Record<string, unknown> {
    const merged = { ...player, ...updates } as DatabasePlayer;

    const valorantRank = merged.valorant_rank || merged.discord_rank || 'Unranked';
    const valorantRankValue = merged.valorant_rank_value ?? merged.discord_rank_value ?? this.getRankValue(valorantRank);
    const valorantMMR = merged.valorant_mmr ?? merged.current_mmr ?? 0;

    const marvelRank = merged.marvel_rivals_rank || 'Unranked';
    const marvelRankValue = merged.marvel_rivals_rank_value ?? this.getRankValue(marvelRank);
    const marvelMMR = merged.marvel_rivals_mmr ?? 0;

    const roleMode = merged.role_mode || 'highest';
    const primaryGame = merged.primary_game || 'valorant';

    let discordRank = valorantRank;
    let discordRankValue = valorantRankValue;
    let currentMMR = valorantMMR;

    if (roleMode === 'primary') {
      if (primaryGame === 'marvel_rivals') {
        discordRank = marvelRank;
        discordRankValue = marvelRankValue;
        currentMMR = marvelMMR;
      }
    } else {
      if (marvelRankValue > valorantRankValue) {
        discordRank = marvelRank;
        discordRankValue = marvelRankValue;
        currentMMR = marvelMMR;
      } else if (marvelRankValue === valorantRankValue && marvelMMR > valorantMMR) {
        discordRank = marvelRank;
        discordRankValue = marvelRankValue;
        currentMMR = marvelMMR;
      }
    }

    return {
      discord_rank: discordRank,
      discord_rank_value: discordRankValue,
      current_mmr: currentMMR,
    };
  }
}
