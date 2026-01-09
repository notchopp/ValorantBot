import { DatabaseService } from './DatabaseService';
import { MatchService } from './MatchService';
import { PlayerService } from './PlayerService';
import { Client } from 'discord.js';

/**
 * Service to handle host timeouts
 * Checks every minute for hosts who haven't confirmed after 10 minutes
 * Follows guardrails: error handling, logging, type safety
 */
export class HostTimeoutService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

  constructor(
    private databaseService: DatabaseService,
    private matchService: MatchService,
    private playerService: PlayerService,
    private client: Client
  ) {}

  /**
   * Start the host timeout checker
   */
  start(): void {
    if (this.intervalId) {
      console.warn('Host timeout service already running');
      return;
    }

    console.log('Starting host timeout service', {
      checkInterval: `${this.CHECK_INTERVAL_MS / 1000}s`,
      timeout: `${this.TIMEOUT_MS / 1000 / 60} minutes`,
    });

    // Run immediately on start, then every minute
    this.checkHostTimeouts();
    this.intervalId = setInterval(() => {
      this.checkHostTimeouts();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Stop the host timeout checker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Host timeout service stopped');
    }
  }

  /**
   * Check for hosts that need to be replaced
   */
  private async checkHostTimeouts(): Promise<void> {
    try {
      const supabase = this.databaseService.supabase;
      if (!supabase) {
        console.warn('Supabase not available for host timeout check');
        return;
      }

      // Find matches with unconfirmed hosts older than 10 minutes
      const tenMinutesAgo = new Date(Date.now() - this.TIMEOUT_MS).toISOString();

      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'pending')
        .eq('host_confirmed', false)
        .not('host_selected_at', 'is', null)
        .lt('host_selected_at', tenMinutesAgo);

      if (error) {
        console.error('Error checking host timeouts', { error: error.message });
        return;
      }

      if (!matches || matches.length === 0) {
        return; // No timeouts
      }

      console.log(`Found ${matches.length} host(s) that timed out`);

      for (const match of matches) {
        await this.replaceTimedOutHost(match);
      }
    } catch (error) {
      console.error('Error in host timeout check', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Replace a timed-out host with a new one
   */
  private async replaceTimedOutHost(match: any): Promise<void> {
    try {
      const supabase = this.databaseService.supabase;
      if (!supabase) {
        return;
      }

      // Get all players in the match
      const teamA: string[] = match.team_a || [];
      const teamB: string[] = match.team_b || [];
      const allPlayerIds = [...teamA, ...teamB];

      // Get current host
      const currentHostId = match.host_user_id;

      // Find eligible players (not the current host)
      const eligiblePlayerIds = allPlayerIds.filter((id: string) => id !== currentHostId);

      if (eligiblePlayerIds.length === 0) {
        console.warn('No eligible players to replace host', { matchId: match.match_id });
        return;
      }

      // Select random new host
      const newHostId = eligiblePlayerIds[Math.floor(Math.random() * eligiblePlayerIds.length)];

      // Update match with new host
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          host_user_id: newHostId,
          host_selected_at: new Date().toISOString(),
          host_confirmed: false,
          host_invite_code: null,
        })
        .eq('match_id', match.match_id);

      if (updateError) {
        console.error('Error replacing timed-out host', {
          matchId: match.match_id,
          error: updateError.message,
        });
        return;
      }

      // Update in-memory match if it exists
      const inMemoryMatch = this.matchService.getCurrentMatch();
      if (inMemoryMatch && inMemoryMatch.matchId === match.match_id) {
        const newHostPlayer = await this.playerService.getPlayer(newHostId);
        if (newHostPlayer) {
          inMemoryMatch.host = newHostPlayer;
          inMemoryMatch.hostSelectedAt = new Date();
          inMemoryMatch.hostConfirmed = false;
          inMemoryMatch.hostInviteCode = undefined;
        }
      }

      // Notify in Discord
      await this.notifyHostReplacement(match.match_id, currentHostId, newHostId);

      console.log('Host replaced due to timeout', {
        matchId: match.match_id,
        oldHost: currentHostId,
        newHost: newHostId,
      });
    } catch (error) {
      console.error('Error replacing timed-out host', {
        matchId: match.match_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Notify about host replacement in Discord
   */
  private async notifyHostReplacement(
    matchId: string,
    _oldHostId: string,
    newHostId: string
  ): Promise<void> {
    try {
      // Find a guild to send the notification
      // We'll try to find the match in any guild the bot is in
      for (const [, guild] of this.client.guilds.cache) {
        try {
          // Try to find a channel where we can post (prefer general/text channels)
          const channel = guild.channels.cache.find(
            (ch: any) => ch.type === 0 && ch.permissionsFor(guild.members.me!)?.has('SendMessages')
          ) as any;

          if (channel) {
            const embed = {
              title: '🔄 Host Auto-Replaced',
              description: `The previous host timed out after 10 minutes.`,
              color: 0xff9900,
              fields: [
                {
                  name: 'New Host',
                  value: `<@${newHostId}>`,
                  inline: false,
                },
                {
                  name: 'Action Required',
                  value: `New host must use \`/host confirm\` to generate invite code.\nUse \`/host info\` to see match details.`,
                  inline: false,
                },
                {
                  name: 'Match ID',
                  value: matchId,
                  inline: true,
                },
              ],
            };

            await channel.send({ embeds: [embed] });
            break; // Only send to one channel
          }
        } catch (error) {
          // Continue to next guild
          continue;
        }
      }

      // Also try to DM the new host
      try {
        const newHost = await this.client.users.fetch(newHostId);
        await newHost.send(
          `🎮 You've been selected as the **new host** for a match!\n\n` +
          `**Match ID:** ${matchId}\n\n` +
          `The previous host timed out.\n\n` +
          `**Steps to host:**\n` +
          `1. Create a custom game in Valorant\n` +
          `2. Valorant will generate a unique invite code\n` +
          `3. Use \`/host confirm\` and enter the code Valorant gave you\n\n` +
          `You have 10 minutes to confirm, or a new host will be selected.`
        );
      } catch (error) {
        // DM failed (user has DMs disabled) - that's okay
        console.warn('Could not DM new host', { newHostId });
      }
    } catch (error) {
      console.error('Error notifying host replacement', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
