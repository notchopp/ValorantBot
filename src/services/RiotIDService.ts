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
   */
  getRiotID(userId: string): { name: string; tag: string; region?: string } | null {
    return this.riotIdMap.get(userId) || null;
  }

  /**
   * Remove Riot ID link for a Discord user
   * Also updates the database to clear Riot ID fields
   */
  async unlinkRiotID(userId: string): Promise<boolean> {
    const removed = this.riotIdMap.delete(userId);
    if (removed) {
      const player = await this.playerService.getPlayer(userId);
      if (player) {
        player.riotId = undefined;
      }
      
      // Also clear from database
      if (this.databaseService) {
        await this.databaseService.unlinkPlayerRiotID(userId);
      }
    }
    return removed;
  }

  /**
   * Check if a user has a linked Riot ID
   */
  hasRiotID(userId: string): boolean {
    return this.riotIdMap.has(userId);
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
