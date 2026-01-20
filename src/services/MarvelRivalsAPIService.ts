import axios, { AxiosInstance } from 'axios';

export interface MarvelRivalsPlayer {
  uid: string;
  username: string;
}

export interface MarvelRivalsStats {
  uid?: string;
  username?: string;
  rank?: string;
  tier?: number | string;
  level?: number;
  [key: string]: unknown;
}

export interface MarvelRivalsStatsV2 {
  uid?: string;
  username?: string;
  rank?: string;
  tier?: number | string;
  level?: number;
  [key: string]: unknown;
}

export interface MarvelRivalsMatch {
  match_uid?: string;
  [key: string]: unknown;
}

export interface MatchHistoryFilters {
  season?: string;
  skip?: number;
  game_mode?: string;
}

export class MarvelRivalsAPIService {
  private api: AxiosInstance;
  private baseURL = 'https://marvelrivalsapi.com/api/v1';
  private apiKey?: string;
  private readonly RATE_LIMIT = 30; // Start conservative, adjust with actual API limits
  private readonly RATE_WINDOW = 60000;
  private requestTimestamps: number[] = [];

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
    const headers: Record<string, string> = {
      'User-Agent': 'ValorantBot-Discord/1.0',
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers,
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after']
            ? parseInt(error.response.headers['retry-after']) * 1000
            : 2000;
          console.warn(`Marvel Rivals API rate limited, waiting ${retryAfter}ms`);
          await this.delay(retryAfter);
          return this.api.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.RATE_WINDOW
    );

    if (this.requestTimestamps.length >= this.RATE_LIMIT) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = this.RATE_WINDOW - (now - oldestTimestamp) + 100;
      if (waitTime > 0) {
        await this.delay(waitTime);
        return this.waitForRateLimit();
      }
    }

    this.requestTimestamps.push(now);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async searchPlayer(username: string): Promise<MarvelRivalsPlayer | null> {
    await this.waitForRateLimit();
    try {
      const encoded = encodeURIComponent(username.trim());
      const response = await this.api.get<{ data?: any }>(`/find-player/${encoded}`);
      const data = response.data?.data || response.data;
      if (!data) {
        return null;
      }
      const uid = data.uid || data.player_uid || data.id;
      const name = data.username || data.name || username;
      if (!uid) {
        return null;
      }
      return { uid, username: name };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error searching Marvel Rivals player', {
        username,
        status: error.response?.status,
        message: error.message,
      });
      return null;
    }
  }

  async getPlayerStats(query: string): Promise<MarvelRivalsStats | null> {
    await this.waitForRateLimit();
    try {
      const encoded = encodeURIComponent(query.trim());
      const response = await this.api.get<{ data?: any }>(`/player/${encoded}`);
      return (response.data?.data || response.data) as MarvelRivalsStats;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching Marvel Rivals player stats', {
        query,
        status: error.response?.status,
        message: error.message,
      });
      return null;
    }
  }

  async getPlayerStatsV2(query: string): Promise<MarvelRivalsStatsV2 | null> {
    await this.waitForRateLimit();
    try {
      const encoded = encodeURIComponent(query.trim());
      const response = await this.api.get<{ data?: any }>(`https://marvelrivalsapi.com/api/v2/player/${encoded}`);
      return (response.data?.data || response.data) as MarvelRivalsStatsV2;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching Marvel Rivals player stats v2', {
        query,
        status: error.response?.status,
        message: error.message,
      });
      return null;
    }
  }

  async getMatchHistory(query: string, filters: MatchHistoryFilters = {}): Promise<MarvelRivalsMatch[] | null> {
    await this.waitForRateLimit();
    try {
      const encoded = encodeURIComponent(query.trim());
      const params = new URLSearchParams();
      if (filters.season) params.append('season', filters.season);
      if (filters.skip !== undefined) params.append('skip', String(filters.skip));
      if (filters.game_mode) params.append('game_mode', filters.game_mode);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await this.api.get<{ data?: any }>(`/player/${encoded}/match-history${queryString}`);
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : data?.matches || null;
    } catch (error: any) {
      console.error('Error fetching Marvel Rivals match history', {
        query,
        status: error.response?.status,
        message: error.message,
      });
      return null;
    }
  }

  async getMatchHistoryV2(query: string, page: number = 1, limit: number = 10): Promise<MarvelRivalsMatch[] | null> {
    await this.waitForRateLimit();
    try {
      const encoded = encodeURIComponent(query.trim());
      const response = await this.api.get<{ data?: any }>(
        `https://marvelrivalsapi.com/api/v2/player/${encoded}/match-history?page=${page}&limit=${limit}`
      );
      const data = response.data?.data || response.data;
      return Array.isArray(data) ? data : data?.matches || null;
    } catch (error: any) {
      console.error('Error fetching Marvel Rivals match history v2', {
        query,
        status: error.response?.status,
        message: error.message,
      });
      return null;
    }
  }

  async getMatchByUID(matchUID: string): Promise<MarvelRivalsMatch | null> {
    await this.waitForRateLimit();
    try {
      const encoded = encodeURIComponent(matchUID.trim());
      const response = await this.api.get<{ data?: any }>(`/match/${encoded}`);
      return (response.data?.data || response.data) as MarvelRivalsMatch;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching Marvel Rivals match by UID', {
        matchUID,
        status: error.response?.status,
        message: error.message,
      });
      return null;
    }
  }

  async updatePlayer(query: string): Promise<boolean> {
    await this.waitForRateLimit();
    try {
      const encoded = encodeURIComponent(query.trim());
      await this.api.get(`/player/${encoded}/update`);
      return true;
    } catch (error: any) {
      if (error.response?.status === 429) {
        return false;
      }
      console.error('Error updating Marvel Rivals player', {
        query,
        status: error.response?.status,
        message: error.message,
      });
      return false;
    }
  }

  parseRankToValue(rankString: string): number {
    if (!rankString) return 0;
    const normalized = rankString.toLowerCase();
    const tiers = [
      'bronze',
      'silver',
      'gold',
      'platinum',
      'diamond',
      'grandmaster',
      'celestial',
      'eternity',
      'one above all',
    ];
    const tierIndex = tiers.findIndex((tier) => normalized.includes(tier));
    if (tierIndex === -1) {
      return 0;
    }
    return tierIndex + 1;
  }

  getRankValueFromStats(stats: MarvelRivalsStats): number {
    const rank = typeof stats.rank === 'string' ? stats.rank : '';
    return this.parseRankToValue(rank);
  }
}
