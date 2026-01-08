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
 * Validate environment variables
 */
export function validateEnv(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
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
