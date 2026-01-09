import { PlayerService } from './PlayerService';
import { DatabaseService } from './DatabaseService';

/**
 * Service to manage Discord user -> Riot ID mappings
 * Stores which Riot account (name#tag) is linked to each Discord user
 */
export class RiotIDService {
  private riotIdMap: Map<string, { name: string; tag: string; region?: string }> = new Map();
  private playerService: PlayerService;
  private databaseService?: DatabaseService;

  constructor(playerService: PlayerService, databaseService?: DatabaseService) {
    this.playerService = playerService;
    this.databaseService = databaseService;
  }

  /**
   * Link a Discord user to a Riot ID
   * Also updates the database if databaseService is available
   */
  async linkRiotID(userId: string, name: string, tag: string, region?: string, puuid?: string): Promise<boolean> {
    const player = await this.playerService.getPlayer(userId);
    if (!player) {
      return false;
    }

    const riotId = { name, tag, region };
    this.riotIdMap.set(userId, riotId);
    player.riotId = riotId;
    
    // Also update database if available
    if (this.databaseService && puuid && region) {
      await this.databaseService.updatePlayerRiotID(userId, name, tag, puuid, region);
    }
    
    return true;
  }

  /**
   * Get Riot ID for a Discord user
   * Checks both in-memory cache and database
   */
  async getRiotID(userId: string): Promise<{ name: string; tag: string; region?: string } | null> {
    // Check memory first
    const memoryRiotId = this.riotIdMap.get(userId);
    if (memoryRiotId) {
      return memoryRiotId;
    }
    
    // If not in memory, check database
    if (this.databaseService) {
      const dbPlayer = await this.databaseService.getPlayer(userId);
      if (dbPlayer?.riot_name && dbPlayer?.riot_tag) {
        // Load into memory for future use
        const riotId = {
          name: dbPlayer.riot_name,
          tag: dbPlayer.riot_tag,
          region: dbPlayer.riot_region || undefined,
        };
        this.riotIdMap.set(userId, riotId);
        
        // Also update player object
        const player = await this.playerService.getPlayer(userId);
        if (player) {
          player.riotId = riotId;
        }
        
        return riotId;
      }
    }
    
    return null;
  }

  /**
   * Remove Riot ID link for a Discord user
   * Checks both in-memory cache and database
   * Also updates the database to clear Riot ID fields
   */
  async unlinkRiotID(userId: string): Promise<boolean> {
    // Check if exists in memory
    const existsInMemory = this.riotIdMap.has(userId);
    
    // Check database if not in memory
    let existsInDatabase = false;
    if (this.databaseService && !existsInMemory) {
      const dbPlayer = await this.databaseService.getPlayer(userId);
      existsInDatabase = !!(dbPlayer?.riot_name && dbPlayer?.riot_tag);
      
      // If found in database but not in memory, load it first so we can clean it up
      if (existsInDatabase && dbPlayer && dbPlayer.riot_name && dbPlayer.riot_tag) {
        this.riotIdMap.set(userId, {
          name: dbPlayer.riot_name,
          tag: dbPlayer.riot_tag,
          region: dbPlayer.riot_region || undefined,
        });
      }
    }
    
    // If exists in either memory or database, proceed with unlink
    if (existsInMemory || existsInDatabase) {
      // Remove from memory
      this.riotIdMap.delete(userId);
      
      // Update player object
      const player = await this.playerService.getPlayer(userId);
      if (player) {
        player.riotId = undefined;
      }
      
      // Always clear from database if database service is available
      if (this.databaseService) {
        const dbSuccess = await this.databaseService.unlinkPlayerRiotID(userId);
        if (!dbSuccess) {
          console.warn('Failed to unlink Riot ID from database', { userId });
        }
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Check if a user has a linked Riot ID
   * Checks both in-memory cache and database
   */
  async hasRiotID(userId: string): Promise<boolean> {
    // Check memory first
    if (this.riotIdMap.has(userId)) {
      return true;
    }
    
    // If not in memory, check database
    if (this.databaseService) {
      const dbPlayer = await this.databaseService.getPlayer(userId);
      return !!(dbPlayer?.riot_name && dbPlayer?.riot_tag);
    }
    
    return false;
  }

  // For future persistence
  getRiotIDMap(): Map<string, { name: string; tag: string; region?: string }> {
    return this.riotIdMap;
  }

  async loadRiotIDMap(map: Map<string, { name: string; tag: string; region?: string }>): Promise<void> {
    this.riotIdMap = map;
    // Update player objects
    for (const [userId, riotId] of map.entries()) {
      const player = await this.playerService.getPlayer(userId);
      if (player) {
        player.riotId = riotId;
      }
    }
  }
}
