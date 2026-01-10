import { createClient } from '@/lib/supabase/server'

export async function AuthAwareMain({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // Add padding only if user is authenticated (nav will be shown)
  return (
    <main className={`relative z-10 min-h-screen ${user ? 'pt-20 md:pt-24' : ''}`}>
      {children}
    </main>
  )
}
