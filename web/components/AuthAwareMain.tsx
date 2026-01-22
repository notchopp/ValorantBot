import { createClient } from '@/lib/supabase/server'

export async function AuthAwareMain({ children }: { children: React.ReactNode }) {
  // Handle missing Supabase credentials gracefully
  let user = null
  try {
    // Check if environment variables are set before trying to create client
    const hasSupabaseConfig = 
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (hasSupabaseConfig) {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      user = data.user
    }
  } catch (error) {
    // Silently fail if Supabase is not configured or fails
    // This allows pages like /hub to work without Supabase
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Supabase not configured, continuing without auth:', error)
    }
  }
  
  // Add padding only if user is authenticated (nav will be shown)
  return (
    <main className={`relative z-10 min-h-screen ${user ? 'pt-20 md:pt-24' : ''}`}>
      {children}
    </main>
  )
}
