import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ClaimForm } from '@/components/ClaimForm'
import { LoginForm } from '@/components/LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; step?: string }
}) {
  const supabase = await createClient()
  
  // Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    // Check if user has claimed a profile
    const { data: player } = await supabase
      .from('players')
      .select('id, riot_name, riot_tag')
      .eq('id', user.id)
      .maybeSingle()
    
    if (player) {
      redirect('/dashboard')
    }
    // User is logged in but hasn't claimed a profile - show claim form
  }
  
  const step = searchParams.step || (user ? 'claim' : 'login')
  
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans">
      <div className="min-h-screen flex">
        {/* Left Side - Login/Claim Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8">
            <div>
              <h1 className="text-4xl font-black tracking-tighter mb-2">
                <span className="text-red-500">#GRNDS</span>
              </h1>
              <p className="text-white/60">
                {step === 'claim' 
                  ? 'Claim your profile to view your stats'
                  : 'Sign in to claim your profile'}
              </p>
            </div>

            {step === 'claim' ? (
              <div>
                <ClaimForm />
                <div className="mt-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-500 font-medium">
                    ⚠️ Warning: False claiming a profile that is not yours will result in a warning and permanent ban.
                  </p>
                </div>
              </div>
            ) : (
              <LoginForm />
            )}

            {step === 'login' && (
              <p className="text-sm text-white/40 text-center">
                Don&apos;t have an account?{' '}
                <a href="/auth/signup" className="text-red-500 hover:text-red-400">
                  Sign up
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Right Side - Info */}
        <div className="hidden lg:flex flex-1 bg-white/[0.02] border-l border-white/5 p-12">
          <div className="max-w-md space-y-8">
            <div>
              <h2 className="text-3xl font-black mb-4">How It Works</h2>
              <p className="text-white/60 leading-relaxed">
                #GRNDS is a custom ranked system for Valorant. Enter your Riot name and tag to claim your profile and view your stats, MMR, and competitive history.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h3 className="font-black text-red-500 mb-2">1. Sign In</h3>
                <p className="text-sm text-white/60">Create an account or sign in with email</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h3 className="font-black text-red-500 mb-2">2. Claim Profile</h3>
                <p className="text-sm text-white/60">Enter your Riot name and tag to claim your profile</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <h3 className="font-black text-red-500 mb-2">3. View Dashboard</h3>
                <p className="text-sm text-white/60">See your stats, MMR, rank, and match history</p>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5">
              <p className="text-xs text-white/40">
                Developed by <span className="text-red-500">chopp</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
