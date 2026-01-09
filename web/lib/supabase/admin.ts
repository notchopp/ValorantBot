import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Admin Client
 * 
 * Uses SERVICE_ROLE_KEY for admin operations.
 * This module is server-only and cannot be imported by client code.
 * 
 * SECURITY: This client bypasses RLS. Only use for:
 * - OAuth callback handlers (with proper validation)
 * - Server-side operations that need to bypass RLS
 * - Creating/updating user records after authentication
 */

let adminClient: ReturnType<typeof createClient> | null = null

export function getSupabaseAdminClient() {
  if (adminClient) {
    return adminClient
  }
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase admin environment variables: ' +
      `NEXT_PUBLIC_SUPABASE_URL=${!!supabaseUrl}, ` +
      `SUPABASE_SERVICE_ROLE_KEY=${!!serviceRoleKey}`
    )
  }
  
  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    },
  })
  
  return adminClient
}
