import { DatabaseService } from './DatabaseService';
import { MatchService } from './MatchService';
import { ValorantAPIService } from './ValorantAPIService';
import { MarvelRivalsAPIService } from './MarvelRivalsAPIService';
import { VercelAPIService } from './VercelAPIService';
import { PlayerService } from './PlayerService';
import { Client } from 'discord.js';

/**
 * Service to automatically detect when matches end (Valorant + Marvel Rivals)
 * Polls game APIs for recent matches and auto-updates ranks
 * Follows guardrails: error handling, logging, rate limiting
 */
export class AutoMatchDetectionService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 2 * 60 * 1000; // Check every 2 minutes
  private readonly MATCH_AGE_THRESHOLD_MS = 30 * 60 * 1000; // Only check matches from last 30 minutes
  private processedMatches: Set<string> = new Set(); // Track processed match IDs

  constructor(
    private databaseService: DatabaseService,
    _matchService: MatchService, // Reserved for future use
    private valorantAPI: ValorantAPIService | undefined,
    private marvelRivalsAPI: MarvelRivalsAPIService | undefined,
    private vercelAPI: VercelAPIService,
    _playerService: PlayerService, // Reserved for future use
    private client: Client
  ) {
    // Services reserved for future use
    void _matchService;
    void _playerService;
  }

  /**
   * Start the auto-match detection service
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Auto-match detection service already running');
      return;
    }

    if (!this.valorantAPI) {
      console.warn('Valorant API not available - auto-match detection disabled');
      return;
    }

    console.log('Starting auto-match detection service', {
      checkInterval: `${this.CHECK_INTERVAL_MS / 1000 / 60} minutes`,
      matchAgeThreshold: `${this.MATCH_AGE_THRESHOLD_MS / 1000 / 60} minutes`,
    });

    // Run immediately on start, then every 2 minutes
    this.checkForCompletedMatches();
    this.intervalId = setInterval(() => {
      this.checkForCompletedMatches();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the auto-match detection service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Auto-match detection service stopped');
    }
  }

  /**
   * Check for completed matches and auto-update ranks
   */
  private async checkForCompletedMatches(): Promise<void> {
    try {
      const supabase = this.databaseService.supabase;
      if (!supabase) {
        console.warn('Supabase not available for auto-match detection');
        return;
      }

      // Find active matches that started recently
      const thirtyMinutesAgo = new Date(Date.now() - this.MATCH_AGE_THRESHOLD_MS).toISOString();

      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .in('status', ['pending', 'in-progress'])
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(10); // Check up to 10 recent matches

      if (error) {
        console.error('Error fetching matches for auto-detection', { error: error.message });
        return;
      }

      if (!matches || matches.length === 0) {
        return; // No active matches
      }

      console.log(`Checking ${matches.length} active match(es) for completion`);

      for (const match of matches) {
        // Skip if already processed
        if (this.processedMatches.has(match.match_id)) {
          continue;
        }

        await this.checkMatchCompletion(match);
      }
    } catch (error) {
      console.error('Error in auto-match detection check', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if a specific match has been completed
   */
  private async checkMatchCompletion(match: any): Promise<void> {
    const matchType = match.match_type;
    
    if (matchType === 'marvel_rivals') {
      await this.checkMarvelRivalsMatchCompletion(match);
    } else {
      await this.checkValorantMatchCompletion(match);
    }
  }

  /**
   * Check Valorant match completion
   */
  private async checkValorantMatchCompletion(match: any): Promise<void> {
    try {
      if (!this.valorantAPI) {
        return;
      }

      // Get all players in the match
      const teamA: string[] = match.team_a || [];
      const teamB: string[] = match.team_b || [];
      const allPlayerIds = [...teamA, ...teamB];

      // Check each player's recent matches
      // If we find a match that started around the same time, it's likely our custom match
      for (const playerId of allPlayerIds) {
        const player = await this.databaseService.getPlayer(playerId);
        if (!player || !player.riot_name || !player.riot_tag || !player.riot_region) {
          continue;
        }

        try {
          // Get recent matches for this player
          const recentMatches = await this.valorantAPI.getMatches(
            player.riot_region,
            player.riot_name,
            player.riot_tag,
            'custom' // Only check custom matches
          );

          if (!recentMatches || recentMatches.length === 0) {
            continue;
          }

          // Find a match that started around the same time as our match
          const matchStartTime = new Date(match.created_at).getTime();

          for (const valorantMatch of recentMatches) {
            const valorantMatchStart = valorantMatch.metadata.game_start * 1000; // Convert to milliseconds
            const timeDiff = Math.abs(valorantMatchStart - matchStartTime);

            // If match started within 5 minutes of our match creation, it's likely our match
            if (timeDiff < 5 * 60 * 1000) {
              // Check if match is completed (has rounds played and game length)
              if (
                valorantMatch.metadata.rounds_played > 0 &&
                valorantMatch.metadata.game_length > 0
              ) {
                // This match appears to be completed!
                await this.processCompletedValorantMatch(match, valorantMatch);
                return; // Process once per match
              }
            }
          }
        } catch (error) {
          // Continue checking other players if one fails
          console.warn('Error checking player matches', {
            playerId,
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }
    } catch (error) {
      console.error('Error checking Valorant match completion', {
        matchId: match.match_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check Marvel Rivals match completion
   */
  private async checkMarvelRivalsMatchCompletion(match: any): Promise<void> {
    try {
      if (!this.marvelRivalsAPI) {
        return;
      }

      const teamA: string[] = match.team_a || [];
      const teamB: string[] = match.team_b || [];
      const allPlayerIds = [...teamA, ...teamB];

      // Build a map of all players with their Marvel Rivals usernames
      const playerMap = new Map<string, any>(); // marvel_rivals_username -> player data
      const discordToPlayer = new Map<string, any>(); // discord_user_id -> player data
      
      for (const playerId of allPlayerIds) {
        const player = await this.databaseService.getPlayer(playerId);
        if (player) {
          discordToPlayer.set(playerId, player);
          if (player.marvel_rivals_username) {
            playerMap.set(player.marvel_rivals_username.toLowerCase(), player);
          }
        }
      }

      // Try to find match from any player whose API works
      let foundMatch: any = null;
      let matchPlayers: any[] = [];
      
      for (const playerId of allPlayerIds) {
        const player = discordToPlayer.get(playerId);
        if (!player?.marvel_rivals_uid) {
          continue;
        }

        try {
          const recentMatches = await this.marvelRivalsAPI.getMatchHistory(player.marvel_rivals_uid, {
            game_mode: 'custom',
          });

          if (!recentMatches || recentMatches.length === 0) {
            continue;
          }

          const matchStartTime = new Date(match.created_at).getTime();

          for (const mrMatch of recentMatches) {
            // Check if match timestamp is close to our match
            const mrMatchTime = this.parseMarvelRivalsTimestamp(mrMatch);
            if (!mrMatchTime) continue;
            
            const timeDiff = Math.abs(mrMatchTime - matchStartTime);

            // If match started within 10 minutes of our match creation
            if (timeDiff < 10 * 60 * 1000) {
              foundMatch = mrMatch;
              matchPlayers = this.extractMarvelRivalsPlayers(mrMatch);
              break;
            }
          }

          if (foundMatch) break;
        } catch (error) {
          console.warn('Error checking Marvel Rivals player matches', {
            playerId,
            error: error instanceof Error ? error.message : String(error),
          });
          continue;
        }
      }

      if (foundMatch && matchPlayers.length > 0) {
        await this.processCompletedMarvelRivalsMatch(match, foundMatch, matchPlayers, playerMap, discordToPlayer);
      }
    } catch (error) {
      console.error('Error checking Marvel Rivals match completion', {
        matchId: match.match_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Parse Marvel Rivals match timestamp
   */
  private parseMarvelRivalsTimestamp(mrMatch: any): number | null {
    // Try common timestamp field names
    const timestamp = mrMatch.match_time || mrMatch.timestamp || mrMatch.created_at || mrMatch.date || mrMatch.start_time;
    if (!timestamp) return null;
    
    if (typeof timestamp === 'number') {
      // If it's a Unix timestamp in seconds, convert to ms
      return timestamp < 10000000000 ? timestamp * 1000 : timestamp;
    }
    if (typeof timestamp === 'string') {
      const parsed = Date.parse(timestamp);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }

  /**
   * Extract player data from Marvel Rivals match
   */
  private extractMarvelRivalsPlayers(mrMatch: any): any[] {
    // Try common field names for players
    const players = mrMatch.players || mrMatch.participants || mrMatch.team_players || [];
    if (Array.isArray(players)) return players;
    
    // Some APIs nest players under teams
    const team1 = mrMatch.team1?.players || mrMatch.team_a?.players || [];
    const team2 = mrMatch.team2?.players || mrMatch.team_b?.players || [];
    return [...team1, ...team2];
  }

  /**
   * Process a completed Valorant match and auto-update ranks
   */
  private async processCompletedValorantMatch(match: any, valorantMatch: any): Promise<void> {
    try {
      const matchId = match.match_id;

      // Mark as processed to avoid duplicate processing
      this.processedMatches.add(matchId);

      console.log('Auto-detected completed Valorant match', {
        matchId,
        valorantMatchId: valorantMatch.metadata.matchid,
        roundsPlayed: valorantMatch.metadata.rounds_played,
      });

      // Determine winner from Valorant match data
      const redTeam = valorantMatch.teams?.red;
      const blueTeam = valorantMatch.teams?.blue;

      let winner: 'A' | 'B' | null = null;
      let score: { teamA: number; teamB: number } | undefined;

      if (redTeam?.has_won && blueTeam?.has_won !== undefined) {
        // Determine which team won based on rounds won
        // We need to map Valorant teams to our Team A/B
        // For now, we'll use a simple heuristic: check which team has more rounds won
        const redRounds = redTeam.rounds_won || 0;
        const blueRounds = blueTeam.rounds_won || 0;

        // Map to our teams (this is a simplification - in reality we'd need to track which players were on which Valorant team)
        // For now, assume Team A = Red, Team B = Blue (or vice versa)
        // We'll need to improve this mapping later
        if (redRounds > blueRounds) {
          winner = 'A'; // Assuming Red = Team A
          score = { teamA: redRounds, teamB: blueRounds };
        } else if (blueRounds > redRounds) {
          winner = 'B'; // Assuming Blue = Team B
          score = { teamA: redRounds, teamB: blueRounds };
        }
      }

      // Extract player stats from Valorant match and determine MVP
      const playerStatsMap = new Map<string, any>();
      let highestScore = 0;
      let mvpPlayerId: string | null = null;

      if (valorantMatch.players?.all_players) {
        for (const valorantPlayer of valorantMatch.players.all_players) {
          // Find our player by Riot ID
          const player = await this.databaseService.getPlayerByRiotID(
            valorantPlayer.name,
            valorantPlayer.tag
          );

          if (player) {
            const stats = valorantPlayer.stats || {};
            const playerScore = stats.score || 0;
            
            // Track MVP - highest score in the match
            if (playerScore > highestScore) {
              highestScore = playerScore;
              mvpPlayerId = player.discord_user_id;
            }
            
            playerStatsMap.set(player.discord_user_id, {
              kills: stats.kills || 0,
              deaths: stats.deaths || 0,
              assists: stats.assists || 0,
              score: playerScore,
              headshots: stats.headshots || 0,
              bodyshots: stats.bodyshots || 0,
              damage: valorantPlayer.damage_made || 0,
              mvp: false, // Will be set after loop
            });
          }
        }
        
        // Set MVP for the highest scorer
        if (mvpPlayerId && playerStatsMap.has(mvpPlayerId)) {
          const mvpStats = playerStatsMap.get(mvpPlayerId);
          mvpStats.mvp = true;
          playerStatsMap.set(mvpPlayerId, mvpStats);
        }
      }

      // Log cross-reference success rate
      const teamA: string[] = match.team_a || [];
      const teamB: string[] = match.team_b || [];
      const totalQueuePlayers = teamA.length + teamB.length;
      const foundStats = playerStatsMap.size;
      console.log('Valorant cross-reference results', {
        matchId,
        totalQueuePlayers,
        playersWithStats: foundStats,
        playersWithoutStats: totalQueuePlayers - foundStats,
        mvp: mvpPlayerId,
      });

      // Update match in database
      const supabase = this.databaseService.supabase;
      if (supabase) {
        await supabase
          .from('matches')
          .update({
            status: 'completed',
            winner: winner,
            score: score ? JSON.stringify(score) : null,
            completed_at: new Date().toISOString(),
          })
          .eq('match_id', matchId);
      }

      // Save player stats to database
      for (const playerId of [...teamA, ...teamB]) {
        const stats = playerStatsMap.get(playerId);
        if (stats) {
          const player = await this.databaseService.getPlayer(playerId);
          if (player) {
            const team = teamA.includes(playerId) ? 'A' : 'B';
            await this.databaseService.createMatchPlayerStats(matchId, playerId, {
              team: team as 'A' | 'B',
              kills: stats.kills,
              deaths: stats.deaths,
              assists: stats.assists,
              mvp: stats.mvp,
              mmrBefore: player.current_mmr || 0,
            });
          }
        }
      }

      // Trigger rank calculation via Vercel
      try {
        const calculateResult = await this.vercelAPI.calculateRank({ matchId });
        if (calculateResult.success) {
          console.log('Auto-updated ranks for completed Valorant match', { matchId });
        } else {
          console.warn('Failed to auto-update ranks', {
            matchId,
            error: calculateResult.error,
          });
        }
      } catch (error) {
        console.error('Error calling calculate-rank API', {
          matchId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Notify in Discord
      await this.notifyMatchCompletion(matchId, winner, score);
    } catch (error) {
      console.error('Error processing completed match', {
        matchId: match.match_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process a completed Marvel Rivals match and auto-update ranks
   * Tracks stats for all players, including those whose API doesn't work (via other players' match data)
   * Cross-references match API data to find stats for ALL queue players
   */
  private async processCompletedMarvelRivalsMatch(
    match: any,
    mrMatch: any,
    matchPlayers: any[],
    playerMap: Map<string, any>,
    discordToPlayer: Map<string, any>
  ): Promise<void> {
    try {
      const matchId = match.match_id;

      // Mark as processed to avoid duplicate processing
      this.processedMatches.add(matchId);

      console.log('Auto-detected completed Marvel Rivals match', {
        matchId,
        playersFound: matchPlayers.length,
      });

      // Build reverse lookup: normalize all possible username variations from match data
      // This allows cross-referencing to find stats for players whose own API failed
      const normalizeUsername = (name: string): string => {
        return (name || '').toLowerCase().trim().replace(/\s+/g, ' ');
      };

      // Extract player stats and determine winner/MVP
      // Cross-reference ALL players from match data against our queue players
      const playerStatsMap = new Map<string, any>();
      let highestScore = 0;
      let mvpPlayerId: string | null = null;
      
      // Track team scores for winner determination
      let team1Score = 0;
      let team2Score = 0;
      
      // Track which API players map to which game teams
      const apiPlayerTeams = new Map<string, string>(); // discordId -> api team

      for (const mrPlayer of matchPlayers) {
        // Try multiple username fields from the API
        const possibleUsernames = [
          mrPlayer.username,
          mrPlayer.player_name,
          mrPlayer.name,
          mrPlayer.display_name,
          mrPlayer.nickname,
        ].filter(Boolean).map(normalizeUsername);
        
        // Try to match against ANY player in our queue
        let matchedPlayer: any = null;
        for (const username of possibleUsernames) {
          if (playerMap.has(username)) {
            matchedPlayer = playerMap.get(username);
            break;
          }
        }
        
        // Also try matching by UID if available
        if (!matchedPlayer && mrPlayer.uid) {
          for (const [, player] of discordToPlayer) {
            if (player.marvel_rivals_uid === mrPlayer.uid) {
              matchedPlayer = player;
              break;
            }
          }
        }

        if (!matchedPlayer) {
          // Log but continue - this player might not be in our queue
          console.log('Marvel Rivals player not in queue', { 
            usernames: possibleUsernames,
            uid: mrPlayer.uid 
          });
          continue;
        }

        // Extract stats from the match player data
        const kills = mrPlayer.kills || mrPlayer.eliminations || 0;
        const deaths = mrPlayer.deaths || 0;
        const assists = mrPlayer.assists || 0;
        const damage = mrPlayer.damage || mrPlayer.damage_dealt || 0;
        const healing = mrPlayer.healing || mrPlayer.healing_done || 0;
        const score = mrPlayer.score || (kills * 100 + assists * 50) || 0;
        const hero = mrPlayer.hero || mrPlayer.character || mrPlayer.hero_name || '';
        const teamId = mrPlayer.team || mrPlayer.team_id || '';
        
        // Track which API team this player is on for team mapping
        apiPlayerTeams.set(matchedPlayer.discord_user_id, String(teamId));
        
        // Track team scores
        if (teamId === 1 || teamId === 'team1' || teamId === 'a') {
          team1Score += score;
        } else {
          team2Score += score;
        }

        // Track MVP - highest score in the match
        if (score > highestScore) {
          highestScore = score;
          mvpPlayerId = matchedPlayer.discord_user_id;
        }

        playerStatsMap.set(matchedPlayer.discord_user_id, {
          kills,
          deaths,
          assists,
          damage,
          healing,
          score,
          hero,
          mvp: false,
        });
      }

      // Set MVP for the highest scorer
      if (mvpPlayerId && playerStatsMap.has(mvpPlayerId)) {
        const mvpStats = playerStatsMap.get(mvpPlayerId);
        mvpStats.mvp = true;
        playerStatsMap.set(mvpPlayerId, mvpStats);
      }

      // Log cross-reference success rate
      const teamA: string[] = match.team_a || [];
      const teamB: string[] = match.team_b || [];
      const totalQueuePlayers = teamA.length + teamB.length;
      const foundStats = playerStatsMap.size;
      console.log('Marvel Rivals cross-reference results', {
        matchId,
        totalQueuePlayers,
        playersWithStats: foundStats,
        playersWithoutStats: totalQueuePlayers - foundStats,
        mvp: mvpPlayerId,
      });

      // Determine winner (simplified - based on team total score)
      let winner: 'A' | 'B' | null = null;
      if (team1Score > team2Score) {
        winner = 'A';
      } else if (team2Score > team1Score) {
        winner = 'B';
      }
      
      // Check if match data has explicit winner
      const matchWinner = mrMatch.winner || mrMatch.winning_team;
      if (matchWinner) {
        if (matchWinner === 1 || matchWinner === 'team1' || matchWinner === 'a' || matchWinner === 'A') {
          winner = 'A';
        } else {
          winner = 'B';
        }
      }

      // Update match in database
      const supabase = this.databaseService.supabase;
      if (supabase) {
        await supabase
          .from('matches')
          .update({
            status: 'completed',
            winner: winner,
            completed_at: new Date().toISOString(),
          })
          .eq('match_id', matchId);
      }

      // Save player stats to database
      for (const playerId of [...teamA, ...teamB]) {
        const stats = playerStatsMap.get(playerId);
        const player = discordToPlayer.get(playerId);
        
        if (player) {
          const team = teamA.includes(playerId) ? 'A' : 'B';
          
          // Use stats if found, otherwise create basic entry (for players whose API failed)
          await this.databaseService.createMatchPlayerStats(matchId, playerId, {
            team: team as 'A' | 'B',
            kills: stats?.kills || 0,
            deaths: stats?.deaths || 0,
            assists: stats?.assists || 0,
            mvp: stats?.mvp || false,
            mmrBefore: player.marvel_rivals_mmr || player.current_mmr || 0,
          });
        }
      }

      // Trigger rank calculation via Vercel
      try {
        const calculateResult = await this.vercelAPI.calculateRank({ matchId });
        if (calculateResult.success) {
          console.log('Auto-updated ranks for completed Marvel Rivals match', { matchId });
        } else {
          console.warn('Failed to auto-update ranks for Marvel Rivals match', {
            matchId,
            error: calculateResult.error,
          });
        }
      } catch (error) {
        console.error('Error calling calculate-rank API for Marvel Rivals', {
          matchId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Notify in Discord
      await this.notifyMatchCompletion(matchId, winner, undefined, 'Marvel Rivals');
    } catch (error) {
      console.error('Error processing completed Marvel Rivals match', {
        matchId: match.match_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Notify about match completion in Discord
   */
  private async notifyMatchCompletion(
    matchId: string,
    winner: 'A' | 'B' | null,
    score?: { teamA: number; teamB: number },
    game: string = 'Valorant'
  ): Promise<void> {
    try {
      // Find a guild to send the notification
      for (const [, guild] of this.client.guilds.cache) {
        try {
          const channel = guild.channels.cache.find(
            (ch: any) => ch.type === 0 && ch.permissionsFor(guild.members.me!)?.has('SendMessages')
          ) as any;

          if (channel) {
            const embed = {
              title: `✅ ${game} Match Auto-Completed`,
              description: `Match **${matchId}** has been automatically detected as completed!`,
              color: 0x00ff00,
              fields: [
                {
                  name: 'Status',
                  value: 'Ranks have been automatically updated based on match results.',
                  inline: false,
                },
              ],
            };

            if (winner) {
              embed.fields.push({
                name: 'Winner',
                value: `Team ${winner}`,
                inline: true,
              });
            }

            if (score) {
              embed.fields.push({
                name: 'Score',
                value: `${score.teamA}-${score.teamB}`,
                inline: true,
              });
            }

            await channel.send({ embeds: [embed] });
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.error('Error notifying match completion', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
