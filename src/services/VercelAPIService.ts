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

/**
 * Service for calling Vercel Cloud Agent APIs
 */
export class VercelAPIService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || process.env.VERCEL_API_URL || '';
    
    if (!this.baseURL) {
      console.warn('VERCEL_API_URL not set - Vercel cloud agents will not be available');
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
      return {
        success: false,
        error: 'Vercel API URL not configured',
      };
    }

    try {
      const response = await this.api.post<VerifyAccountResponse>(
        '/api/verify-account',
        request
      );
      return response.data;
    } catch (error: any) {
      console.error('Error calling verify-account API', {
        userId: request.userId,
        riotId: `${request.riotName}#${request.riotTag}`,
        error: error.message,
        status: error.response?.status,
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
      return {
        success: false,
        error: 'Vercel API URL not configured',
      };
    }

    try {
      const response = await this.api.post<CalculateRankResponse>(
        '/api/calculate-rank',
        request
      );
      return response.data;
    } catch (error: any) {
      console.error('Error calling calculate-rank API', {
        matchId: request.matchId,
        error: error.message,
        status: error.response?.status,
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
      return {
        success: false,
        error: 'Vercel API URL not configured',
      };
    }

    try {
      const response = await this.api.post<ProcessQueueResponse>(
        '/api/process-queue',
        request
      );
      return response.data;
    } catch (error: any) {
      console.error('Error calling process-queue API', {
        balancingMode: request.balancingMode,
        error: error.message,
        status: error.response?.status,
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
}
