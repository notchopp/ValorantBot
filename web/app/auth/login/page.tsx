import { DiscordLoginButton } from '@/components/DiscordLoginButton'

export default async function LoginPage() {
  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center p-8">
      <div className="w-full max-w-lg space-y-8 text-center">
        {/* Terminal-style header */}
        <div className="mb-12">
          <div className="text-xs font-mono text-white/40 mb-2 tracking-wider">
            {'>'} GRNDS TERMINAL ACCESS
          </div>
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-4">
            <span className="text-red-500">GRNDS</span>
          </h1>
          <div className="text-xs font-mono text-white/40 tracking-wider">
            {'>'} INITIALIZING AUTHENTICATION PROTOCOL...
          </div>
        </div>

        {/* Login button */}
        <div className="space-y-6">
          <DiscordLoginButton />
        </div>

        {/* Terminal-style info box */}
        <div className="mt-12 p-6 border border-red-500/20 bg-black/50 backdrop-blur-sm">
          <div className="text-xs font-mono text-red-500 mb-3 tracking-wider">
            {'>'} SYSTEM UPDATE
          </div>
          <div className="text-lg font-black text-white mb-2 font-mono">
            Marvel Rivals Support
          </div>
          <p className="text-sm text-white/60 font-mono leading-relaxed">
            Link your Marvel Rivals account in Discord and track ranks, MMR, and match history alongside Valorant.
          </p>
          <div className="mt-4 text-xs font-mono text-white/30">
            {'>'} STATUS: ACTIVE
          </div>
        </div>

        {/* Terminal prompt */}
        <div className="mt-8 text-xs font-mono text-white/20">
          {'>'} Type &apos;help&apos; for commands or authenticate to continue...
        </div>
      </div>
    </div>
  )
}
