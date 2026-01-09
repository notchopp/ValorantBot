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
  games_needed_for_rating?: number; // v3 API field for placement matches
}

export interface ValorantMMRHistoryEntry {
  tier?: {
    id: number;
    name: string;
  };
  elo?: number;
  match_id?: string;
  date?: string;
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
  private baseURL = 'https://api.henrikdev.xyz/valorant';
  private apiKey?: string;
  private readonly RATE_LIMIT = 30; // 30 requests per minute
  private readonly RATE_WINDOW = 60000; // 1 minute in milliseconds
  private requestTimestamps: number[] = [];

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

    // Add response interceptor to handle rate limits
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = error.response.headers['retry-after'] 
            ? parseInt(error.response.headers['retry-after']) * 1000 
            : 2000; // Default 2 seconds
          console.warn(`Rate limited by API, waiting ${retryAfter}ms before retry`);
          await this.delay(retryAfter);
          return this.api.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Rate limiting: ensure we don't exceed 30 requests per minute
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.RATE_WINDOW
    );

    // If we're at the limit, wait until the oldest request expires
    if (this.requestTimestamps.length >= this.RATE_LIMIT) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.RATE_WINDOW - (now - oldestTimestamp) + 100; // Add 100ms buffer
      if (waitTime > 0) {
        console.warn(`Rate limit reached (${this.RATE_LIMIT}/min), waiting ${waitTime}ms`);
        await this.delay(waitTime);
        // Recursively check again after waiting
        return this.waitForRateLimit();
      }
    }

    // Record this request
    this.requestTimestamps.push(now);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get account information by Riot ID (using v2 for console support)
   */
  async getAccount(name: string, tag: string): Promise<ValorantAccount | null> {
    await this.waitForRateLimit();
    try {
      // Ensure tag is treated as a string (handles numeric tags like "1017")
      const encodedName = encodeURIComponent(name.trim());
      const encodedTag = encodeURIComponent(String(tag).trim());
      
      const url = `/v2/account/${encodedName}/${encodedTag}`;
      console.log('Fetching Valorant account', { name, tag, encodedName, encodedTag, url });
      
      const response = await this.api.get<{ status: number; data: ValorantAccount }>(url);
      
      // Handle different possible response structures
      if (response.data?.data) {
        const account = response.data.data;
        if (account.puuid && account.name && account.tag) {
          console.log('Account found successfully', { 
            name: account.name, 
            tag: account.tag, 
            puuid: account.puuid.substring(0, 8) + '...' 
          });
          return account;
        }
      }
      
      // If response structure is different, try direct access
      if (response.data && 'puuid' in response.data && 'name' in response.data && 'tag' in response.data) {
        console.log('Account found (alternative response structure)');
        // Type assertion after checking required fields
        return response.data as unknown as ValorantAccount;
      }
      
      console.warn('Unexpected response structure from account API', { 
        status: response.status, 
        dataKeys: Object.keys(response.data || {}) 
      });
      return null;
    } catch (error: any) {
      // Log detailed error information
      console.error(`Error fetching account for ${name}#${tag}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        responseData: error.response?.data,
        url: error.config?.url,
      });
      
      if (error.response?.status === 404) {
        return null;
      }
      
      // For other errors, still return null but log the details
      return null;
    }
  }

  /**
   * Get current MMR/rank by region and Riot ID (v1 - kept for backward compatibility)
   */
  async getMMR(region: string, name: string, tag: string): Promise<ValorantMMR | null> {
    await this.waitForRateLimit();
    try {
      // First get account to get PUUID
      const account = await this.getAccount(name, tag);
      if (!account) return null;
      
      // Use v3 endpoint with PUUID
      return await this.getMMRByPUUID(region, account.puuid);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching MMR for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get current MMR/rank by PUUID (v3 API)
   */
  async getMMRByPUUID(region: string, puuid: string, platform: string = 'pc'): Promise<ValorantMMR | null> {
    await this.waitForRateLimit();
    try {
      const response = await this.api.get<{ status: number; data: any }>(
        `/v3/by-puuid/mmr/${region}/${platform}/${puuid}`
      );
      
      const data = response.data.data;
      if (!data) return null;
      
      // Map v3 response to ValorantMMR interface
      return {
        currenttier: data.current?.tier?.id || 0,
        currenttierpatched: data.current?.tier?.name || 'Unrated',
        ranking_in_tier: data.current?.ranking_in_tier || 0,
        mmr_change_to_last_game: data.current?.mmr_change_to_last_game || 0,
        elo: data.current?.elo || 0,
        name: data.name || '',
        tag: data.tag || '',
        old: data.old || false,
        games_needed_for_rating: data.current?.games_needed_for_rating || 0,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching MMR by PUUID ${puuid}:`, error.message);
      return null;
    }
  }

  /**
   * Get MMR history for a player (v2 by-puuid endpoint)
   */
  async getMMRHistory(name: string, tag: string): Promise<ValorantMMRHistory[] | null> {
    await this.waitForRateLimit();
    try {
      // First get account to get PUUID
      const account = await this.getAccount(name, tag);
      if (!account) return null;
      
      // Use v2 by-puuid endpoint
      return await this.getMMRHistoryByPUUID(account.region, account.puuid);
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching MMR history for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get MMR history by PUUID (v2 API)
   */
  async getMMRHistoryByPUUID(region: string, puuid: string, platform: string = 'pc'): Promise<ValorantMMRHistory[] | null> {
    await this.waitForRateLimit();
    try {
      const response = await this.api.get<{ status: number; data: any }>(
        `/v2/by-puuid/mmr-history/${region}/${platform}/${puuid}`
      );
      return response.data.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching MMR history by PUUID ${puuid}:`, error.message);
      return null;
    }
  }

  /**
   * Get the last ranked rank from MMR history (more efficient - stops early)
   * Returns the most recent ranked entry (not unrated) from previous acts/seasons
   */
  async getLastRankedRank(name: string, tag: string): Promise<{ rank: string; elo: number; date: string } | null> {
    await this.waitForRateLimit();
    try {
      // First get account to get PUUID
      const account = await this.getAccount(name, tag);
      if (!account) return null;
      
      const response = await this.api.get<{ status: number; data: any }>(
        `/v2/by-puuid/mmr-history/${account.region}/pc/${account.puuid}`
      );
      
      if (!response.data.data || !response.data.data.history || response.data.data.history.length === 0) {
        return null;
      }

      // MMR history is typically sorted by date (most recent first)
      // Find the first ranked entry (not unrated) - this is the last ranked rank
      for (const entry of response.data.data.history) {
        if (
          entry.tier &&
          entry.tier.name &&
          !entry.tier.name.toLowerCase().includes('unrated') &&
          entry.tier.id > 0
        ) {
          return {
            rank: entry.tier.name,
            elo: entry.elo || 0,
            date: entry.date || new Date().toISOString(),
          };
        }
      }

      return null; // No ranked entries found
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error(`Error fetching last ranked rank for ${name}#${tag}:`, error.message);
      return null;
    }
  }

  /**
   * Get match history for a player
   */
  async getMatches(region: string, name: string, tag: string, mode?: string): Promise<ValorantMatch[] | null> {
    await this.waitForRateLimit();
    try {
      const url = mode
        ? `/v1/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?mode=${mode}`
        : `/v1/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
      
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
    await this.waitForRateLimit();
    try {
      const response = await this.api.get<{ status: number; data: ValorantMatch }>(
        `/v1/match/${matchId}`
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
