import { Queue, createQueue, isQueueFull } from '../models/Queue';
import { Player } from '../models/Player';
import { Config } from '../config/config';
import { DatabaseService } from './DatabaseService';
import { PlayerService } from './PlayerService';

/**
 * QueueService with Supabase persistence
 * Follows guardrails: error handling, logging, type safety
 */
type QueueGame = 'valorant' | 'marvel_rivals';

interface QueueState {
  queue: Queue;
  isLockedFlag: boolean;
  queueStartMessageId: string | null;
  queueStartChannelId: string | null;
  queueId: string | null;
}

export class QueueService {
  private queueStates: Record<QueueGame, QueueState>;
  private config: Config;
  private dbService: DatabaseService;
  private playerService: PlayerService;

  constructor(config: Config, dbService: DatabaseService, playerService: PlayerService) {
    this.config = config;
    this.dbService = dbService;
    this.playerService = playerService;
    this.queueStates = {
      valorant: {
        queue: createQueue(),
        isLockedFlag: false,
        queueStartMessageId: null,
        queueStartChannelId: null,
        queueId: null,
      },
      marvel_rivals: {
        queue: createQueue(),
        isLockedFlag: false,
        queueStartMessageId: null,
        queueStartChannelId: null,
        queueId: null,
      },
    };
  }

  /**
   * Join queue - persists to Supabase
   * Follows guardrails: error handling, validation
   */
  async join(
    player: Player,
    game: QueueGame = 'valorant'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const state = this.getState(game);
      // Check if queue is locked
      if (state.isLockedFlag) {
        return { success: false, message: 'Queue is locked. A match is in progress.' };
      }

      // Check if queue is full (from database)
      const queueSize = await this.getCurrentQueueSize(game);
      if (queueSize >= this.config.queue.maxPlayers) {
        return { success: false, message: 'Queue is full.' };
      }

      // Add to database
      const added = await this.dbService.addPlayerToQueue(player.userId, game);
      if (!added) {
        return { success: false, message: 'You are already in the queue.' };
      }

      // Update in-memory cache
      if (!state.queue.players.some((p) => p.userId === player.userId)) {
        state.queue.players.push(player);
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
  async leave(
    userId: string,
    game: QueueGame = 'valorant'
  ): Promise<{ success: boolean; message: string }> {
    try {
      const state = this.getState(game);
      if (state.isLockedFlag) {
        return { success: false, message: 'Queue is locked. Cannot leave during match.' };
      }

      // Remove from database
      const removed = await this.dbService.removePlayerFromQueue(userId, game);
      if (!removed) {
        return { success: false, message: 'You are not in the queue.' };
      }

      // Update in-memory cache
      const index = state.queue.players.findIndex((p) => p.userId === userId);
      if (index !== -1) {
        state.queue.players.splice(index, 1);
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
  async getStatus(game: QueueGame = 'valorant'): Promise<Queue> {
    try {
      await this.loadQueueFromDatabase(game);
      return this.getState(game).queue;
    } catch (error) {
      console.error('Error getting queue status', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getState(game).queue; // Return cached version on error
    }
  }

  /**
   * Check if queue is full
   */
  async isFull(game: QueueGame = 'valorant'): Promise<boolean> {
    try {
      const size = await this.getCurrentQueueSize(game);
      return size >= this.config.queue.maxPlayers;
    } catch (error) {
      console.error('Error checking if queue is full', {
        error: error instanceof Error ? error.message : String(error),
      });
      return isQueueFull(this.getState(game).queue, this.config.queue.maxPlayers); // Fallback to cache
    }
  }

  /**
   * Get current queue size from database
   */
  private async getCurrentQueueSize(game: QueueGame): Promise<number> {
    try {
      const queuePlayers = await this.dbService.getQueuePlayers(game);
      return queuePlayers.length;
    } catch (error) {
      console.error('Error getting queue size', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getState(game).queue.players.length; // Fallback to cache
    }
  }

  /**
   * Lock queue (prevents joins/leaves)
   */
  lock(game: QueueGame = 'valorant'): void {
    const state = this.getState(game);
    state.isLockedFlag = true;
    state.queue.isLocked = true;
  }

  /**
   * Unlock queue
   */
  unlock(game: QueueGame = 'valorant'): void {
    const state = this.getState(game);
    state.isLockedFlag = false;
    state.queue.isLocked = false;
  }

  /**
   * Clear queue - removes all from database
   * Follows guardrails: error handling
   */
  async clear(game: QueueGame = 'valorant'): Promise<boolean> {
    try {
      const cleared = await this.dbService.clearQueue(game);
      if (cleared) {
        const state = this.getState(game);
        state.queue = createQueue();
        state.isLockedFlag = false;
        state.queueStartMessageId = null;
        state.queueStartChannelId = null;
        state.queueId = null;
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
   * Set queue start message info for later deletion
   */
  setQueueStartMessage(
    messageId: string,
    channelId: string,
    queueId: string,
    game: QueueGame = 'valorant'
  ): void {
    const state = this.getState(game);
    state.queueStartMessageId = messageId;
    state.queueStartChannelId = channelId;
    state.queueId = queueId;
  }

  /**
   * Get queue start message info
   */
  getQueueStartMessage(
    game: QueueGame = 'valorant'
  ): { messageId: string | null; channelId: string | null; queueId: string | null } {
    const state = this.getState(game);
    return {
      messageId: state.queueStartMessageId,
      channelId: state.queueStartChannelId,
      queueId: state.queueId,
    };
  }

  /**
   * Clear queue start message info
   */
  clearQueueStartMessage(game: QueueGame = 'valorant'): void {
    const state = this.getState(game);
    state.queueStartMessageId = null;
    state.queueStartChannelId = null;
    state.queueId = null;
  }

  /**
   * Get players from queue - loads from database
   * Follows guardrails: error handling
   */
  async getPlayers(game: QueueGame = 'valorant'): Promise<Player[]> {
    try {
      await this.loadQueueFromDatabase(game);
      return [...this.getState(game).queue.players];
    } catch (error) {
      console.error('Error getting queue players', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [...this.getState(game).queue.players]; // Return cached version on error
    }
  }

  /**
   * Get current queue size (synchronous, from cache)
   */
  getCurrentQueueSizeSync(game: QueueGame = 'valorant'): number {
    return this.getState(game).queue.players.length;
  }

  /**
   * Load queue from database into memory cache
   * Follows guardrails: error handling, null checks
   */
  async loadQueueFromDatabase(game: QueueGame = 'valorant'): Promise<void> {
    try {
      const dbQueue = await this.dbService.getQueuePlayers(game);
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
      const state = this.getState(game);
      state.queue.players = players;
      state.queue.createdAt = dbQueue.length > 0
        ? new Date(dbQueue[0].joined_at)
        : new Date();
    } catch (error) {
      console.error('Error loading queue from database', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - keep existing cache
    }
  }

  private getState(game: QueueGame): QueueState {
    return this.queueStates[game];
  }
}
