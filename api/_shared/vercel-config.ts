/**
 * Shared configuration and utilities for Vercel API routes
 */

export const VERCEL_CONFIG = {
  // Timeout for external API calls (10 seconds)
  API_TIMEOUT: 10000,
  
  // Rate limiting (30 req/min for Valorant API)
  RATE_LIMIT: 30,
  RATE_WINDOW: 60000, // 1 minute
};

/**
 * Validate environment variables and return env object
 */
export function validateEnv(): {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  VALORANT_API_KEY?: string;
} {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    SUPABASE_URL: process.env.SUPABASE_URL!,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY!,
    VALORANT_API_KEY: process.env.VALORANT_API_KEY,
  };
}

/**
 * Create standardized error response
 */
export function createErrorResponse(message: string, statusCode: number = 500) {
  return {
    success: false,
    error: message,
    statusCode,
  };
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(data: T) {
  return {
    success: true,
    ...data,
  };
}
