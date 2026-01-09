import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DiscordLoginButton } from '@/components/DiscordLoginButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string }
}) {
  const supabase = await createClient()
  
  // Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div className="max-w-md w-full glass rounded-[2rem] p-8 md:p-12 border border-white/5">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-3 tracking-tighter">Sign In</h1>
          <p className="text-base md:text-lg text-white/60 font-light leading-relaxed">
            Connect with Discord to post comments, track your progress, and engage with the community
          </p>
        </div>
        
        <div className="space-y-6">
          {searchParams.error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400 font-medium">
                Authentication failed. Please try again.
              </p>
            </div>
          )}
          
          <DiscordLoginButton />
          
          <div className="pt-6 border-t border-white/5">
            <Link
              href="/"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 hover:text-[#ffd700] transition-colors inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
