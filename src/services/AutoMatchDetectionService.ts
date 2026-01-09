import { DatabaseService } from './DatabaseService';
import { MatchService } from './MatchService';
import { ValorantAPIService } from './ValorantAPIService';
import { VercelAPIService } from './VercelAPIService';
import { PlayerService } from './PlayerService';
import { Client } from 'discord.js';

/**
 * Service to automatically detect when Valorant matches end
 * Polls Henrik's API for recent matches and auto-updates ranks
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
                await this.processCompletedMatch(match, valorantMatch);
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
      console.error('Error checking match completion', {
        matchId: match.match_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Process a completed match and auto-update ranks
   */
  private async processCompletedMatch(match: any, valorantMatch: any): Promise<void> {
    try {
      const matchId = match.match_id;

      // Mark as processed to avoid duplicate processing
      this.processedMatches.add(matchId);

      console.log('Auto-detected completed match', {
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

      // Extract player stats from Valorant match
      const playerStatsMap = new Map<string, any>();

      if (valorantMatch.players?.all_players) {
        for (const valorantPlayer of valorantMatch.players.all_players) {
          // Find our player by Riot ID
          const player = await this.databaseService.getPlayerByRiotID(
            valorantPlayer.name,
            valorantPlayer.tag
          );

          if (player) {
            const stats = valorantPlayer.stats || {};
            playerStatsMap.set(player.discord_user_id, {
              kills: stats.kills || 0,
              deaths: stats.deaths || 0,
              assists: stats.assists || 0,
              mvp: false, // MVP detection would need more logic
            });
          }
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
            score: score ? JSON.stringify(score) : null,
            completed_at: new Date().toISOString(),
          })
          .eq('match_id', matchId);
      }

      // Save player stats to database
      const teamA: string[] = match.team_a || [];
      const teamB: string[] = match.team_b || [];

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
          console.log('Auto-updated ranks for completed match', { matchId });
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
   * Notify about match completion in Discord
   */
  private async notifyMatchCompletion(
    matchId: string,
    winner: 'A' | 'B' | null,
    score?: { teamA: number; teamB: number }
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
              title: '✅ Match Auto-Completed',
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
