import { Player, createPlayer, PlayerStats } from '../models/Player';
import { Config } from '../config/config';
import { ValorantAPIService, ValorantMMR } from './ValorantAPIService';
import { DatabaseService } from './DatabaseService';

export class PlayerService {
  private players: Map<string, Player> = new Map(); // Cache for quick access
  private config: Config;
  private valorantAPI?: ValorantAPIService;
  private dbService: DatabaseService;

  constructor(config: Config, valorantAPI?: ValorantAPIService, dbService?: DatabaseService) {
    this.config = config;
    this.valorantAPI = valorantAPI;
    this.dbService = dbService || new DatabaseService();
  }

  async getOrCreatePlayer(userId: string, username: string): Promise<Player> {
    // Try cache first
    let player = this.players.get(userId);
    if (player) {
      if (player.username !== username) {
        player.username = username;
      }
      return player;
    }

    // Try database
    const dbPlayer = await this.dbService.getOrCreatePlayer(userId, username);
    if (dbPlayer) {
      player = this.dbService.databasePlayerToModel(dbPlayer);
      this.players.set(userId, player); // Cache it
      return player;
    }

    // Fallback to in-memory (if database not available)
    player = createPlayer(userId, username);
    this.players.set(userId, player);
    return player;
  }

  async getPlayer(userId: string): Promise<Player | undefined> {
    // Try cache first
    let player = this.players.get(userId);
    if (player) return player;

    // Try database
    const dbPlayer = await this.dbService.getPlayer(userId);
    if (dbPlayer) {
      player = this.dbService.databasePlayerToModel(dbPlayer);
      this.players.set(userId, player); // Cache it
      return player;
    }

    return undefined;
  }

  setPlayerRank(userId: string, rank: string): boolean {
    const player = this.players.get(userId);
    if (!player) {
      return false;
    }

    const rankValue = this.config.ranks.numericValues[rank];
    if (!rankValue) {
      return false;
    }

    player.rank = rank;
    player.rankValue = rankValue;
    return true;
  }

  /**
   * Fetch and update player rank from Valorant API
   * Requires Riot ID to be linked
   */
  async fetchRankFromAPI(userId: string): Promise<{ success: boolean; rank?: string; rankValue?: number; message?: string }> {
    const player = this.players.get(userId);
    if (!player) {
      return { success: false, message: 'Player not found' };
    }

    if (!player.riotId) {
      return { success: false, message: 'No Riot ID linked. Use /riot link to link your account.' };
    }

    if (!this.valorantAPI) {
      return { success: false, message: 'Valorant API service not available' };
    }

    // Default region if not set (can be improved with region detection)
    const region = player.riotId.region || 'na';
    
    try {
      const mmr = await this.valorantAPI.getMMR(
        region,
        player.riotId.name,
        player.riotId.tag
      );

      if (!mmr) {
        return { success: false, message: 'Could not fetch rank from API. Check your Riot ID.' };
      }

      const rankValue = this.valorantAPI.getRankValueFromMMR(mmr);
      player.rank = mmr.currenttierpatched;
      player.rankValue = rankValue;

      return {
        success: true,
        rank: mmr.currenttierpatched,
        rankValue,
      };
    } catch (error: any) {
      return { success: false, message: `API error: ${error.message}` };
    }
  }

  /**
   * Update rank from MMR data (used when fetching multiple players)
   */
  updateRankFromMMR(userId: string, mmr: ValorantMMR): boolean {
    const player = this.players.get(userId);
    if (!player || !this.valorantAPI) {
      return false;
    }

    player.rank = mmr.currenttierpatched;
    player.rankValue = this.valorantAPI.getRankValueFromMMR(mmr);
    return true;
  }

  updatePlayerStats(userId: string, updates: Partial<PlayerStats>): boolean {
    const player = this.players.get(userId);
    if (!player) {
      return false;
    }

    Object.assign(player.stats, updates);
    return true;
  }

  async getTopPlayersByPoints(limit: number = 10): Promise<Player[]> {
    // Try database first
    const dbPlayers = await this.dbService.getTopPlayers(limit);
    if (dbPlayers.length > 0) {
      return dbPlayers.map(p => this.dbService.databasePlayerToModel(p));
    }

    // Fallback to cache
    const allPlayers = await this.getAllPlayers();
    return allPlayers
      .sort((a, b) => b.stats.points - a.stats.points)
      .slice(0, limit);
  }

  async getAllPlayers(): Promise<Player[]> {
    // If cache has players, return them
    if (this.players.size > 0) {
      return Array.from(this.players.values());
    }
    return [];
  }

  // Cache management
  invalidateCache(userId?: string): void {
    if (userId) {
      this.players.delete(userId);
    } else {
      this.players.clear();
    }
  }
}
