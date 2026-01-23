import { Client, Guild } from 'discord.js';
import { DatabaseService } from './DatabaseService';
import { RoleUpdateService } from './RoleUpdateService';

/**
 * Background service that periodically syncs Discord roles with database ranks
 * Ensures player roles match their computed rank even if they were updated externally
 * Follows guardrails: error handling, logging, type safety
 */
export class RoleSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private static readonly SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // Every 24 hours
  private static readonly BATCH_SIZE = 50; // Process players in batches
  private static readonly DELAY_BETWEEN_PLAYERS_MS = 500; // Rate limit protection
  // Protected roles that should never be touched by role sync
  private static readonly PROTECTED_ROLES = ['#grndskeeper', '#grndsbooster', '#grndsmaker', 'keeper', 'booster', 'maker'];

  constructor(
    private client: Client,
    private databaseService: DatabaseService,
    private roleUpdateService: RoleUpdateService
  ) {}

  /**
   * Start the role sync background service
   */
  start(): void {
    if (this.syncInterval) {
      console.warn('⚠️ Role sync service already running');
      return;
    }

    console.log('🔄 Starting role sync service (24 hour interval)');

    // Run immediately on start (delayed to not overwhelm on startup)
    setTimeout(() => {
      this.syncAllPlayerRoles().catch((err) => {
        console.error('Error in initial role sync', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, 30000); // Wait 30 seconds after bot startup

    // Then run on interval
    this.syncInterval = setInterval(() => {
      this.syncAllPlayerRoles().catch((err) => {
        console.error('Error in role sync interval', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, RoleSyncService.SYNC_INTERVAL_MS);
  }

  /**
   * Stop the role sync service
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('🛑 Role sync service stopped');
    }
  }

  /**
   * Sync Discord roles for all ranked players
   */
  private async syncAllPlayerRoles(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Get the first guild (main Discord server)
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        console.warn('⚠️ No guild found for role sync');
        return;
      }

      console.log('🔄 Starting role sync for all players', {
        guildId: guild.id,
        guildName: guild.name,
      });

      // Get all ranked players from database
      const players = await this.getRankedPlayers();
      if (players.length === 0) {
        console.log('ℹ️ No ranked players to sync');
        return;
      }

      let synced = 0;
      let errors = 0;
      let skipped = 0;

      // Process in batches to avoid overwhelming the API
      for (let i = 0; i < players.length; i += RoleSyncService.BATCH_SIZE) {
        const batch = players.slice(i, i + RoleSyncService.BATCH_SIZE);
        
        for (const player of batch) {
          try {
            const result = await this.syncPlayerRole(player, guild);
            if (result.synced) {
              synced++;
            } else if (result.skipped) {
              skipped++;
            }
          } catch (error) {
            errors++;
            console.error('Error syncing player role', {
              discordUserId: player.discord_user_id,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          // Small delay between players to respect rate limits
          if (synced + errors + skipped < players.length) {
            await this.delay(RoleSyncService.DELAY_BETWEEN_PLAYERS_MS);
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log('✅ Role sync completed', {
        totalPlayers: players.length,
        synced,
        skipped,
        errors,
        durationMs: duration,
      });
    } catch (error) {
      console.error('❌ Error in role sync', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Sync a single player's role
   */
  private async syncPlayerRole(
    player: { discord_user_id: string; discord_rank: string | null },
    guild: Guild
  ): Promise<{ synced: boolean; skipped: boolean }> {
    try {
      // Skip unranked players
      if (!player.discord_rank || player.discord_rank === 'Unranked') {
        return { synced: false, skipped: true };
      }

      // Try to fetch member from guild
      let member;
      try {
        member = await guild.members.fetch(player.discord_user_id);
      } catch {
        // Member not in guild (left or banned)
        return { synced: false, skipped: true };
      }

      // Skip members with protected roles (KEEPER, BOOSTER, MAKER)
      const hasProtectedRole = member.roles.cache.some((role: any) => {
        if (!role?.name) return false;
        const roleNameLower = role.name.toLowerCase();
        return RoleSyncService.PROTECTED_ROLES.some((pr) => roleNameLower.includes(pr));
      });
      if (hasProtectedRole) {
        return { synced: false, skipped: true };
      }

      // Get member's current rank role
      const currentRankRole = this.getCurrentRankRole(member);
      const expectedRank = player.discord_rank;

      // Check if role matches expected rank
      if (currentRankRole === expectedRank) {
        return { synced: false, skipped: true };
      }

      // Update role
      const result = await this.roleUpdateService.updatePlayerRole(
        player.discord_user_id,
        currentRankRole || 'Unranked',
        expectedRank,
        guild
      );

      if (result.success) {
        console.log('🔄 Role synced', {
          discordUserId: player.discord_user_id,
          username: member.user.username,
          from: currentRankRole || 'none',
          to: expectedRank,
        });
        return { synced: true, skipped: false };
      }

      return { synced: false, skipped: false };
    } catch (error) {
      throw error; // Let caller handle
    }
  }

  /**
   * Get member's current rank role name
   */
  private getCurrentRankRole(member: any): string | null {
    const rankNames = ['grnds', 'breakpoint', 'challenger', 'absolute', 'x'];
    
    const rankRole = member.roles.cache.find((role: any) => {
      if (!role?.name) return false;
      const roleNameLower = role.name.toLowerCase();
      return rankNames.some((rn) => roleNameLower.includes(rn));
    });

    return rankRole?.name || null;
  }

  /**
   * Get all ranked players from database
   */
  private async getRankedPlayers(): Promise<{ discord_user_id: string; discord_rank: string | null }[]> {
    try {
      const supabase = this.databaseService.supabase;
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('players')
        .select('discord_user_id, discord_rank')
        .not('discord_rank', 'is', null)
        .neq('discord_rank', 'Unranked')
        .order('discord_rank_value', { ascending: false });

      if (error) {
        console.error('Error fetching ranked players', {
          error: error.message,
        });
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching ranked players', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Force sync a specific player (can be called externally)
   */
  async forceSyncPlayer(discordUserId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const guild = this.client.guilds.cache.first();
      if (!guild) {
        return { success: false, message: 'No guild found' };
      }

      const player = await this.databaseService.getPlayer(discordUserId);
      if (!player) {
        return { success: false, message: 'Player not found' };
      }

      const result = await this.syncPlayerRole(
        { discord_user_id: discordUserId, discord_rank: player.discord_rank },
        guild
      );

      return {
        success: result.synced,
        message: result.synced ? 'Role synced' : result.skipped ? 'Already in sync' : 'Failed to sync',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
