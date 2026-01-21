import { DiscordLoginButton } from '@/components/DiscordLoginButton'

export default async function LoginPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-6xl font-black tracking-tighter mb-6">
            <span className="text-red-500">GRNDS</span>
          </h1>
        </div>

        <div className="space-y-6">
          <DiscordLoginButton />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left">
          <div className="text-xs font-black uppercase tracking-[0.25em] text-white/40">New</div>
          <div className="mt-2 text-lg font-black text-white">Marvel Rivals Support</div>
          <p className="mt-2 text-sm text-white/60">
            Link your Marvel Rivals account in Discord and track ranks, MMR, and match history alongside Valorant.
          </p>
        </div>
      </div>
    </div>
  )
}
