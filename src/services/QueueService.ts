import { Queue, createQueue, isQueueFull } from '../models/Queue';
import { Player } from '../models/Player';
import { Config } from '../config/config';
import { DatabaseService } from './DatabaseService';
import { PlayerService } from './PlayerService';

/**
 * QueueService with Supabase persistence
 * Follows guardrails: error handling, logging, type safety
 */
export class QueueService {
  private queue: Queue; // In-memory cache for fast access
  private config: Config;
  private dbService: DatabaseService;
  private playerService: PlayerService;
  private isLockedFlag: boolean = false; // Track lock state separately

  constructor(config: Config, dbService: DatabaseService, playerService: PlayerService) {
    this.config = config;
    this.dbService = dbService;
    this.playerService = playerService;
    this.queue = createQueue();
  }

  /**
   * Join queue - persists to Supabase
   * Follows guardrails: error handling, validation
   */
  async join(player: Player): Promise<{ success: boolean; message: string }> {
    try {
      // Check if queue is locked
      if (this.isLockedFlag) {
        return { success: false, message: 'Queue is locked. A match is in progress.' };
      }

      // Check if queue is full (from database)
      const queueSize = await this.getCurrentQueueSize();
      if (queueSize >= this.config.queue.maxPlayers) {
        return { success: false, message: 'Queue is full.' };
      }

      // Add to database
      const added = await this.dbService.addPlayerToQueue(player.userId);
      if (!added) {
        return { success: false, message: 'You are already in the queue.' };
      }

      // Update in-memory cache
      if (!this.queue.players.some((p) => p.userId === player.userId)) {
        this.queue.players.push(player);
      }

      const remaining = this.config.queue.maxPlayers - queueSize - 1;
      return {
        success: true,
        message: `Joined queue. ${remaining} player${remaining !== 1 ? 's' : ''} needed.`,
      };
    } catch (error) {
      console.error('Error joining queue', {
        userId: player.userId,
        username: player.username,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, message: 'An error occurred while joining the queue.' };
    }
  }

  /**
   * Leave queue - removes from Supabase
   * Follows guardrails: error handling, validation
   */
  async leave(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      if (this.isLockedFlag) {
        return { success: false, message: 'Queue is locked. Cannot leave during match.' };
      }

      // Remove from database
      const removed = await this.dbService.removePlayerFromQueue(userId);
      if (!removed) {
        return { success: false, message: 'You are not in the queue.' };
      }

      // Update in-memory cache
      const index = this.queue.players.findIndex((p) => p.userId === userId);
      if (index !== -1) {
        this.queue.players.splice(index, 1);
      }

      return { success: true, message: 'Left the queue.' };
    } catch (error) {
      console.error('Error leaving queue', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, message: 'An error occurred while leaving the queue.' };
    }
  }

  /**
   * Get queue status - loads from database
   * Follows guardrails: error handling
   */
  async getStatus(): Promise<Queue> {
    try {
      await this.loadQueueFromDatabase();
      return this.queue;
    } catch (error) {
      console.error('Error getting queue status', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.queue; // Return cached version on error
    }
  }

  /**
   * Check if queue is full
   */
  async isFull(): Promise<boolean> {
    try {
      const size = await this.getCurrentQueueSize();
      return size >= this.config.queue.maxPlayers;
    } catch (error) {
      console.error('Error checking if queue is full', {
        error: error instanceof Error ? error.message : String(error),
      });
      return isQueueFull(this.queue, this.config.queue.maxPlayers); // Fallback to cache
    }
  }

  /**
   * Get current queue size from database
   */
  private async getCurrentQueueSize(): Promise<number> {
    try {
      const queuePlayers = await this.dbService.getQueuePlayers();
      return queuePlayers.length;
    } catch (error) {
      console.error('Error getting queue size', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.queue.players.length; // Fallback to cache
    }
  }

  /**
   * Lock queue (prevents joins/leaves)
   */
  lock(): void {
    this.isLockedFlag = true;
    this.queue.isLocked = true;
  }

  /**
   * Unlock queue
   */
  unlock(): void {
    this.isLockedFlag = false;
    this.queue.isLocked = false;
  }

  /**
   * Clear queue - removes all from database
   * Follows guardrails: error handling
   */
  async clear(): Promise<boolean> {
    try {
      const cleared = await this.dbService.clearQueue();
      if (cleared) {
        this.queue = createQueue();
        this.isLockedFlag = false;
      }
      return cleared;
    } catch (error) {
      console.error('Error clearing queue', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get players from queue - loads from database
   * Follows guardrails: error handling
   */
  async getPlayers(): Promise<Player[]> {
    try {
      await this.loadQueueFromDatabase();
      return [...this.queue.players];
    } catch (error) {
      console.error('Error getting queue players', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [...this.queue.players]; // Return cached version on error
    }
  }

  /**
   * Get current queue size (synchronous, from cache)
   */
  getCurrentQueueSizeSync(): number {
    return this.queue.players.length;
  }

  /**
   * Load queue from database into memory cache
   * Follows guardrails: error handling, null checks
   */
  async loadQueueFromDatabase(): Promise<void> {
    try {
      const dbQueue = await this.dbService.getQueuePlayers();
      const players: Player[] = [];

      for (const queueEntry of dbQueue) {
        try {
          // Get player by player_id (UUID from database)
          // Note: queueEntry.player_id is a UUID, not discord_user_id
          // We need to get the player by their database ID
          const supabase = this.dbService.supabase;
          if (!supabase) {
            console.warn('Supabase not available for queue loading');
            continue;
          }

          const { data: dbPlayer, error: playerError } = await supabase
            .from('players')
            .select('discord_user_id')
            .eq('id', queueEntry.player_id)
            .single();

          if (playerError || !dbPlayer) {
            console.warn('Queue entry references non-existent player', {
              queueEntryId: queueEntry.id,
              playerId: queueEntry.player_id,
              error: playerError?.message,
            });
            continue;
          }

          // Get player model by Discord user ID
          const player = await this.playerService.getPlayer(dbPlayer.discord_user_id);
          if (player) {
            players.push(player);
          }
        } catch (error) {
          console.error('Error loading player from queue entry', {
            queueEntryId: queueEntry.id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with next player
        }
      }

      // Update in-memory queue
      this.queue.players = players;
      this.queue.createdAt = dbQueue.length > 0
        ? new Date(dbQueue[0].joined_at)
        : new Date();
    } catch (error) {
      console.error('Error loading queue from database', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - keep existing cache
    }
  }
}
