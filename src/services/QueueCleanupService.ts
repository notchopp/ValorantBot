import { Client } from 'discord.js';
import { DatabaseService } from './DatabaseService';
import { QueueService } from './QueueService';
import { PersistentQueueService } from './PersistentQueueService';

/**
 * Service to automatically clean up stale queue entries
 * Players are auto-kicked after 30 minutes of sitting in queue
 * Follows guardrails: error handling, logging, type safety
 */
export class QueueCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly QUEUE_TIMEOUT_MINUTES = 30;
  private static readonly CLEANUP_INTERVAL_MS = 60 * 1000; // Check every 1 minute

  constructor(
    private client: Client,
    private databaseService: DatabaseService,
    private queueService: QueueService,
    private persistentQueueService: PersistentQueueService | null
  ) {}

  /**
   * Start the queue cleanup background service
   */
  start(): void {
    if (this.cleanupInterval) {
      console.warn('⚠️ Queue cleanup service already running');
      return;
    }

    console.log('🧹 Starting queue cleanup service (30 min timeout)');
    
    // Run immediately on start
    this.cleanupExpiredEntries().catch((err) => {
      console.error('Error in initial queue cleanup', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Then run on interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries().catch((err) => {
        console.error('Error in queue cleanup interval', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, QueueCleanupService.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the queue cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('🛑 Queue cleanup service stopped');
    }
  }

  /**
   * Remove expired queue entries (players sitting for > 30 minutes)
   */
  private async cleanupExpiredEntries(): Promise<void> {
    try {
      const games: ('valorant' | 'marvel_rivals')[] = ['valorant', 'marvel_rivals'];
      let totalRemoved = 0;
      const removedPlayers: { discordId: string; game: string; minutesInQueue: number }[] = [];

      for (const game of games) {
        const removed = await this.removeExpiredQueueEntriesForGame(game);
        totalRemoved += removed.length;
        removedPlayers.push(...removed);
      }

      if (totalRemoved > 0) {
        console.log(`🧹 Cleaned up ${totalRemoved} expired queue entries`, {
          players: removedPlayers.map(p => ({ ...p })),
        });

        // Refresh persistent queue messages
        if (this.persistentQueueService) {
          await this.persistentQueueService.updatePersistentQueueMessage();
        }

        // Notify removed players via DM (optional, non-blocking)
        for (const removed of removedPlayers) {
          this.notifyRemovedPlayer(removed.discordId, removed.game, removed.minutesInQueue).catch(() => {
            // Ignore DM errors (user may have DMs disabled)
          });
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired queue entries', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove expired entries for a specific game
   */
  private async removeExpiredQueueEntriesForGame(
    game: 'valorant' | 'marvel_rivals'
  ): Promise<{ discordId: string; game: string; minutesInQueue: number }[]> {
    const removed: { discordId: string; game: string; minutesInQueue: number }[] = [];

    try {
      const supabase = this.databaseService.supabase;
      if (!supabase) return removed;

      // Calculate cutoff time (30 minutes ago)
      const cutoffTime = new Date(Date.now() - QueueCleanupService.QUEUE_TIMEOUT_MINUTES * 60 * 1000);

      // Get expired queue entries with player info
      const { data: expiredEntries, error: fetchError } = await supabase
        .from('queue')
        .select('id, player_id, joined_at, players!inner(discord_user_id)')
        .eq('game', game)
        .lt('joined_at', cutoffTime.toISOString());

      if (fetchError) {
        console.error('Error fetching expired queue entries', {
          game,
          error: fetchError.message,
        });
        return removed;
      }

      if (!expiredEntries || expiredEntries.length === 0) {
        return removed;
      }

      // Delete expired entries
      const expiredIds = expiredEntries.map((e) => e.id);
      const { error: deleteError } = await supabase
        .from('queue')
        .delete()
        .in('id', expiredIds);

      if (deleteError) {
        console.error('Error deleting expired queue entries', {
          game,
          error: deleteError.message,
        });
        return removed;
      }

      // Update in-memory queue cache
      for (const entry of expiredEntries) {
        const discordId = (entry.players as any)?.discord_user_id;
        if (discordId) {
          // Remove from in-memory queue
          this.queueService.removeFromMemoryCache(discordId, game);

          const joinedAt = new Date(entry.joined_at);
          const minutesInQueue = Math.floor((Date.now() - joinedAt.getTime()) / 60000);

          removed.push({
            discordId,
            game,
            minutesInQueue,
          });
        }
      }

      return removed;
    } catch (error) {
      console.error('Error removing expired queue entries for game', {
        game,
        error: error instanceof Error ? error.message : String(error),
      });
      return removed;
    }
  }

  /**
   * Send DM to removed player (best-effort, non-blocking)
   */
  private async notifyRemovedPlayer(
    discordId: string,
    game: string,
    minutesInQueue: number
  ): Promise<void> {
    try {
      const user = await this.client.users.fetch(discordId);
      if (!user) return;

      const gameLabel = game === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant';
      await user.send({
        content: `⏰ You were automatically removed from the **${gameLabel}** queue after ${minutesInQueue} minutes of inactivity.\n\nFeel free to rejoin anytime using \`/queue join\` or the queue buttons in the lobby!`,
      });
    } catch {
      // User has DMs disabled or blocked the bot - that's fine
    }
  }

  /**
   * Set the persistent queue service (for late initialization)
   */
  setPersistentQueueService(service: PersistentQueueService): void {
    this.persistentQueueService = service;
  }
}
