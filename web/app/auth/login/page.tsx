import { DiscordLoginButton } from '@/components/DiscordLoginButton'

export default async function LoginPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans">
      <div className="min-h-screen flex">
        {/* Left Side - Login Form */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-md space-y-8">
            <div>
              <h1 className="text-4xl font-black tracking-tighter mb-2">
                <span className="text-red-500">#GRNDS</span>
              </h1>
              <p className="text-white/60">
                Sign in with Discord to claim your profile and view your stats
              </p>
            </div>

            <div className="space-y-6">
              <DiscordLoginButton />
              
              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-500 font-medium">
                  ⚠️ Important: False claiming a profile that is not yours will result in a warning and permanent ban.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Info */}
        <div className="hidden lg:flex flex-1 bg-white/[0.02] border-l border-white/5 p-12">
          <div className="max-w-md space-y-8">
            {/* System Explanation */}
            <div>
              <h2 className="text-3xl font-black mb-4">How It Works</h2>
              <p className="text-white/60 leading-relaxed mb-6">
                #GRNDS is a custom ranked system for Valorant. View your stats, MMR, rank progression, and competitive history all in one place.
              </p>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="font-black text-red-500 mb-2">Real MMR Tracking</h3>
                  <p className="text-sm text-white/60">Track your MMR changes, rank ups, and competitive performance over time</p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="font-black text-red-500 mb-2">Match History</h3>
                  <p className="text-sm text-white/60">View detailed match statistics, K/D ratios, and MVP performances</p>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="font-black text-red-500 mb-2">Leaderboards</h3>
                  <p className="text-sm text-white/60">See where you rank among all players in the system</p>
                </div>
              </div>
            </div>

            {/* Claim System Explanation */}
            <div className="pt-8 border-t border-white/5">
              <h2 className="text-3xl font-black mb-4">Claiming Your Profile</h2>
              <p className="text-white/60 leading-relaxed mb-4">
                Sign in with Discord to automatically claim your profile. Your Discord account is matched to your player record, and you&apos;ll have immediate access to your personal dashboard with all your stats and competitive data.
              </p>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                  <h3 className="font-black text-red-500 mb-2 text-sm">Profile Lock</h3>
                  <p className="text-xs text-white/60">Once a profile is claimed, it cannot be claimed by anyone else. Your Discord account is permanently linked to your player profile.</p>
                </div>
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
