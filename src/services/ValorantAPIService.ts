import axios, { AxiosInstance } from 'axios';

export interface ValorantAccount {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card?: {
    small: string;
    large: string;
    wide: string;
    id: string;
  };
}

export interface ValorantMMR {
  currenttier: number;
  currenttierpatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  name: string;
  tag: string;
  old: boolean;
}

export interface ValorantMMRHistory {
  name: string;
  tag: string;
  region: string;
  currenttier: number;
  currenttierpatched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  date: string;
  date_raw: number;
}

export interface ValorantMatch {
  metadata: {
    map: string;
    game_version: string;
    game_length: number;
    game_start: number;
    game_start_patched: string;
    rounds_played: number;
    mode: string;
    mode_id: string;
    queue: string;
    season_id: string;
    platform: string;
    matchid: string;
    region: string;
    cluster: string;
  };
  players: {
    all_players: Array<{
      puuid: string;
      name: string;
      tag: string;
      team: string;
      level: number;
      character: string;
      currenttier: number;
      currenttier_patched: string;
      player_card: string;
      player_title: string;
      party_id: string;
      session_playtime: {
        minutes: number;
        seconds: number;
        milliseconds: number;
      };
      behavior: {
        afk_rounds: number;
        friendly_fire: {
          incoming: number;
          outgoing: number;
        };
        rounds_in_spawn: number;
      };
      platform: {
        type: string;
        os: {
          name: string;
          version: string;
        };
      };
      ability_casts: {
        c_casts: number;
        q_casts: number;
        e_casts: number;
        x_casts: number;
      };
      assets: {
        card: {
          small: string;
          large: string;
          wide: string;
        };
        agent: {
          small: string;
          full: string;
          bust: string;
          killfeed: string;
        };
      };
      stats: {
        score: number;
        kills: number;
        deaths: number;
        assists: number;
        bodyshots: number;
        headshots: number;
        legshots: number;
      };
      economy: {
        spent: {
          overall: number;
          average: number;
        };
        loadout_value: {
          overall: number;
          average: number;
        };
      };
      damage_made: number;
      damage_received: number;
    }>;
    red: Array<any>;
    blue: Array<any>;
  };
  teams: {
    red: {
      has_won: boolean;
      rounds_won: number;
      rounds_lost: number;
      roster?: any;
    };
    blue: {
      has_won: boolean;
      rounds_won: number;
      rounds_lost: number;
      roster?: any;
    };
  };
  rounds: Array<any>;
}

export class ValorantAPIService {
  private api: AxiosInstance;
  private baseURL = 'https://api.henrikdev.xyz/valorant/v1';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    const headers: Record<string, string> = {
      'User-Agent': 'ValorantBot-Discord/1.0',
    };

    // Add API key to headers if provided
    // HenrikDev API uses Authorization header with the API key
    if (this.apiKey) {
      headers['Authorization'] = this.apiKey;
    }

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers,
    });
  }

  /**
   * Get account information by Riot ID
   */
  async getAccount(name: string, tag: string): Promise<ValorantAccount | null> {
    try {
      const response = await this.api.get<{ status: number; data: ValorantAccount }>(
        `/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching account for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get current MMR/rank by region and Riot ID
   */
  async getMMR(region: string, name: string, tag: string): Promise<ValorantMMR | null> {
    try {
      const response = await this.api.get<{ status: number; data: ValorantMMR }>(
        `/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching MMR for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get MMR history for a player
   */
  async getMMRHistory(name: string, tag: string): Promise<ValorantMMRHistory[] | null> {
    try {
      const response = await this.api.get<{ status: number; data: ValorantMMRHistory[] }>(
        `/mmr-history/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching MMR history for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get rank for a player, handling unranked/placement players
   * If player is unranked, searches through MMR history to find last ranked match
   * This handles placement matches (up to 5 games where player is unranked)
   */
  async getRankWithFallback(region: string, name: string, tag: string): Promise<ValorantMMR | null> {
    try {
      // First, try to get current MMR
      const currentMMR = await this.getMMR(region, name, tag);
      
      // If no MMR data at all, player hasn't played ranked
      if (!currentMMR) {
        return null;
      }

      // Check if player is unranked (tier 0 or "Unranked" string)
      const isUnranked = 
        currentMMR.currenttier === 0 || 
        currentMMR.currenttierpatched?.toLowerCase() === 'unranked' ||
        !currentMMR.currenttierpatched;

      // If player has a rank, return it
      if (!isUnranked) {
        return currentMMR;
      }

      // Player is unranked, likely in placement matches
      // Try to find last ranked match from MMR history
      console.log(`Player ${name}#${tag} is unranked, checking MMR history for last ranked match`);
      
      const mmrHistory = await this.getMMRHistory(name, tag);
      
      if (!mmrHistory || mmrHistory.length === 0) {
        // No history available, return current (unranked) data
        console.log(`No MMR history found for ${name}#${tag}, using unranked status`);
        return currentMMR;
      }

      // Find the most recent ranked match (non-zero tier)
      for (const match of mmrHistory) {
        if (match.currenttier > 0 && match.currenttierpatched && match.currenttierpatched.toLowerCase() !== 'unranked') {
          console.log(`Found last ranked match for ${name}#${tag}: ${match.currenttierpatched} (${match.elo} ELO)`);
          // Return the ranked match data in the same format as current MMR
          return {
            currenttier: match.currenttier,
            currenttierpatched: match.currenttierpatched,
            ranking_in_tier: match.ranking_in_tier,
            mmr_change_to_last_game: match.mmr_change_to_last_game,
            elo: match.elo,
            name: match.name,
            tag: match.tag,
            old: false,
          };
        }
      }

      // No ranked matches found in history, player may be truly new to ranked
      console.log(`No ranked matches found in history for ${name}#${tag}, using unranked status`);
      return currentMMR;
    } catch (error: any) {
      console.error(`Error fetching rank with fallback for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get match history for a player
   */
  async getMatches(region: string, name: string, tag: string, mode?: string): Promise<ValorantMatch[] | null> {
    try {
      const url = mode
        ? `/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mode=${mode}`
        : `/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
      
      const response = await this.api.get<{ status: number; data: ValorantMatch[] }>(url);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching matches for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get match details by match ID
   */
  async getMatchByID(matchId: string): Promise<ValorantMatch | null> {
    try {
      const response = await this.api.get<{ status: number; data: ValorantMatch }>(
        `/match/${matchId}`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching match ${matchId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse rank string to numeric value for balancing
   * Maps Valorant ranks to numeric values
   */
  parseRankToValue(rankString: string): number {
    const rankMap: Record<string, number> = {
      'Iron 1': 1,
      'Iron 2': 2,
      'Iron 3': 3,
      'Bronze 1': 4,
      'Bronze 2': 5,
      'Bronze 3': 6,
      'Silver 1': 7,
      'Silver 2': 8,
      'Silver 3': 9,
      'Gold 1': 10,
      'Gold 2': 11,
      'Gold 3': 12,
      'Platinum 1': 13,
      'Platinum 2': 14,
      'Platinum 3': 15,
      'Diamond 1': 16,
      'Diamond 2': 17,
      'Diamond 3': 18,
      'Ascendant 1': 19,
      'Ascendant 2': 20,
      'Ascendant 3': 21,
      'Immortal 1': 22,
      'Immortal 2': 23,
      'Immortal 3': 24,
      'Radiant': 25,
    };

    // Try exact match first
    if (rankMap[rankString]) {
      return rankMap[rankString];
    }

    // Try partial match (e.g., "Immortal" matches "Immortal 1")
    for (const [key, value] of Object.entries(rankMap)) {
      if (rankString.toLowerCase().includes(key.toLowerCase().split(' ')[0])) {
        return value;
      }
    }

    return 0; // Unranked
  }

  /**
   * Get rank value from MMR data
   */
  getRankValueFromMMR(mmr: ValorantMMR): number {
    return this.parseRankToValue(mmr.currenttierpatched);
  }
}
