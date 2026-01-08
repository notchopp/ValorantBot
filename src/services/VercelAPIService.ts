/**
 * Service for calling Vercel Cloud Agent APIs
 * 
 * Handles all communication with Vercel serverless functions.
 * Follows guardrails: error handling, timeouts, logging
 */

import axios, { AxiosInstance } from 'axios';

export interface VerifyAccountRequest {
  userId: string;
  username: string;
  riotName: string;
  riotTag: string;
  region: string;
}

export interface VerifyAccountResponse {
  success: boolean;
  discordRank?: string;
  discordRankValue?: number;
  startingMMR?: number;
  valorantRank?: string;
  valorantELO?: number;
  message?: string;
  error?: string;
}

export interface CalculateRankRequest {
  matchId: string;
}

export interface CalculateRankResponse {
  success: boolean;
  results?: Array<{
    playerId: string;
    oldMMR: number;
    newMMR: number;
    oldRank: string;
    newRank: string;
    rankChanged: boolean;
    pointsEarned: number;
  }>;
  error?: string;
}

export interface ProcessQueueRequest {
  balancingMode?: 'auto' | 'captain';
}

export interface ProcessQueueResponse {
  success: boolean;
  match?: {
    matchId: string;
    map: string;
    hostUserId: string;
    teamA: string[];
    teamB: string[];
  };
  error?: string;
}

export interface RefreshRankRequest {
  userId: string;
  riotName: string;
  riotTag: string;
  region: string;
}

export interface RefreshRankResponse {
  success: boolean;
  discordRank?: string;
  discordRankValue?: number;
  newMMR?: number;
  oldRank?: string;
  oldMMR?: number;
  valorantRank?: string;
  boosted?: boolean;
  message?: string;
  error?: string;
}

/**
 * Service for calling Vercel Cloud Agent APIs
 */
export class VercelAPIService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.VERCEL_API_URL || '';
    
    if (!this.baseURL) {
      console.error('❌ VERCEL_API_URL not set - Vercel cloud agents will not be available');
      console.error('Set it with: fly secrets set VERCEL_API_URL=https://your-app.vercel.app');
    } else {
      console.log('✅ Vercel API initialized', { baseURL: this.baseURL });
    }

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds (Vercel functions can take up to 30s)
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ValorantBot-Fly.io/1.0',
      },
    });
  }

  /**
   * Verify account and get initial rank placement
   * Follows guardrails: error handling, logging, timeouts
   */
  async verifyAccount(request: VerifyAccountRequest): Promise<VerifyAccountResponse> {
    if (!this.baseURL) {
      console.error('verifyAccount called but VERCEL_API_URL is not set');
      return {
        success: false,
        error: 'Vercel API URL not configured. Please set VERCEL_API_URL in Fly.io secrets.',
      };
    }

    console.log('Calling Vercel verify-account API', {
      url: `${this.baseURL}/api/verify-account`,
      userId: request.userId,
      riotId: `${request.riotName}#${request.riotTag}`,
    });

    try {
      const response = await this.api.post<VerifyAccountResponse>(
        '/api/verify-account',
        request
      );
      console.log('Vercel verify-account API success', {
        userId: request.userId,
        success: response.data.success,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error calling verify-account API', {
        userId: request.userId,
        riotId: `${request.riotName}#${request.riotTag}`,
        url: `${this.baseURL}/api/verify-account`,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
      });

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        error: error.message || 'Failed to verify account',
      };
    }
  }

  /**
   * Calculate rank changes after match
   * Follows guardrails: error handling, logging, timeouts
   */
  async calculateRank(request: CalculateRankRequest): Promise<CalculateRankResponse> {
    if (!this.baseURL) {
      console.error('calculateRank called but VERCEL_API_URL is not set');
      return {
        success: false,
        error: 'Vercel API URL not configured. Please set VERCEL_API_URL in Fly.io secrets.',
      };
    }

    console.log('Calling Vercel calculate-rank API', {
      url: `${this.baseURL}/api/calculate-rank`,
      matchId: request.matchId,
    });

    try {
      const response = await this.api.post<CalculateRankResponse>(
        '/api/calculate-rank',
        request
      );
      console.log('Vercel calculate-rank API success', {
        matchId: request.matchId,
        success: response.data.success,
        resultsCount: response.data.results?.length || 0,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error calling calculate-rank API', {
        matchId: request.matchId,
        url: `${this.baseURL}/api/calculate-rank`,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        error: error.message || 'Failed to calculate rank',
      };
    }
  }

  /**
   * Process queue when full (10 players)
   * Follows guardrails: error handling, logging, timeouts
   */
  async processQueue(request: ProcessQueueRequest = {}): Promise<ProcessQueueResponse> {
    if (!this.baseURL) {
      console.error('processQueue called but VERCEL_API_URL is not set');
      return {
        success: false,
        error: 'Vercel API URL not configured. Please set VERCEL_API_URL in Fly.io secrets.',
      };
    }

    console.log('Calling Vercel process-queue API', {
      url: `${this.baseURL}/api/process-queue`,
      balancingMode: request.balancingMode || 'auto',
    });

    try {
      const response = await this.api.post<ProcessQueueResponse>(
        '/api/process-queue',
        request
      );
      console.log('Vercel process-queue API success', {
        success: response.data.success,
        matchId: response.data.match?.matchId,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error calling process-queue API', {
        balancingMode: request.balancingMode,
        url: `${this.baseURL}/api/process-queue`,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        error: error.message || 'Failed to process queue',
      };
    }
  }

  /**
   * Refresh rank from Valorant API (uses highest of Valorant rank or current Discord rank, capped at GRNDS V)
   * Follows guardrails: error handling, logging, timeouts
   */
  async refreshRank(request: RefreshRankRequest): Promise<RefreshRankResponse> {
    if (!this.baseURL) {
      console.error('refreshRank called but VERCEL_API_URL is not set');
      return {
        success: false,
        error: 'Vercel API URL not configured. Please set VERCEL_API_URL in Fly.io secrets.',
      };
    }

    console.log('Calling Vercel refresh-rank API', {
      url: `${this.baseURL}/api/refresh-rank`,
      userId: request.userId,
      riotId: `${request.riotName}#${request.riotTag}`,
      region: request.region,
    });

    try {
      const response = await this.api.post<RefreshRankResponse>(
        '/api/refresh-rank',
        request
      );
      console.log('Vercel refresh-rank API success', {
        userId: request.userId,
        success: response.data.success,
        boosted: response.data.boosted,
        newRank: response.data.discordRank,
      });
      return response.data;
    } catch (error: any) {
      console.error('Error calling refresh-rank API', {
        userId: request.userId,
        riotId: `${request.riotName}#${request.riotTag}`,
        url: `${this.baseURL}/api/refresh-rank`,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        error: error.message || 'Failed to refresh rank',
      };
    }
  }
}
