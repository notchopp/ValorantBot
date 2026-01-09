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
    <div className="min-h-screen relative bg-[#1a1a1a] text-white font-sans tracking-tight">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-20 md:pt-32 px-4 md:px-8">
        <div className="max-w-[1200px] mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 mb-8">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                Custom Ranked System
              </span>
            </div>
            
            <h1 className="text-6xl sm:text-7xl md:text-9xl font-black leading-[0.85] tracking-tighter mb-8">
              <span className="text-red-500">#GRNDS</span>
            </h1>
            
            <p className="text-2xl md:text-4xl font-light text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed">
              Custom ranked system for Valorant. Real MMR tracking. Climb from GRNDS to X rank.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <DiscordLoginButton />
              <Link
                href="/leaderboard"
                className="px-10 py-5 border-2 border-white/20 bg-white/5 rounded-xl font-black uppercase tracking-wider text-sm hover:bg-white/10 hover:border-red-500/50 transition-all"
              >
                View Leaderboard
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto mb-20">
            {[
              { label: "Players", value: "Live" },
              { label: "Matches", value: "Tracked" },
              { label: "System", value: "Custom" }
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="text-2xl font-black text-red-500 mb-2">{stat.value}</div>
                <div className="text-xs font-medium uppercase tracking-wider text-white/40">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              How <span className="text-red-500">#GRNDS</span> Works
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              A complete custom ranked system built for competitive Valorant.
            </p>
          </div>

          <div className="space-y-8 mb-20">
            {[
              {
                step: "1",
                title: "Link Your Riot ID",
                desc: "Connect your Valorant account using /riot link in Discord. Your account is verified and ready to compete.",
                code: "/riot link"
              },
              {
                step: "2",
                title: "Get Verified & Placed",
                desc: "Run /verify to get your initial rank placement. You'll start at GRNDS I and begin your climb.",
                code: "/verify"
              },
              {
                step: "3",
                title: "Join the Queue",
                desc: "Use /queue join to enter matchmaking. When 10 players are ready, teams are balanced and the match begins.",
                code: "/queue join"
              },
              {
                step: "4",
                title: "Play & Report",
                desc: "Play your match. The host confirms the game, then use /match report to submit results. MMR updates automatically.",
                code: "/match report"
              }
            ].map((item) => (
              <div key={item.step} className="p-10 rounded-3xl bg-white/[0.02] border border-white/5">
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-black text-red-500">{item.step}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black mb-4">{item.title}</h3>
                    <p className="text-lg text-white/60 leading-relaxed mb-4">
                      {item.desc.replace(item.code, '').trim()}
                      <code className="px-2 py-1 bg-black/50 rounded text-red-500 text-sm ml-2">{item.code}</code>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Rank System */}
      <section className="py-32 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              The <span className="text-red-500">Rank</span> System
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12">
              Four competitive tiers. Real MMR tracking. Climb from GRNDS to X rank.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {[
              {
                rank: "GRNDS",
                tier: "I - V",
                mmr: "0 - 999 MMR",
                desc: "Starting rank. Every player begins here. Learn the system, improve, and climb.",
                color: "bg-orange-500/10 border-orange-500/30 text-orange-500"
              },
              {
                rank: "BREAKPOINT",
                tier: "I - V",
                mmr: "1000 - 1999 MMR",
                desc: "You've proven yourself. Competitive matches await. Push for CHALLENGER.",
                color: "bg-white/[0.02] border-white/10 text-white"
              },
              {
                rank: "CHALLENGER",
                tier: "I - V",
                mmr: "2000 - 2999 MMR",
                desc: "Elite tier. Top players compete here. Only the best reach 3000+ MMR.",
                color: "bg-red-500/10 border-red-500/30 text-red-500"
              },
              {
                rank: "X RANK",
                tier: "",
                mmr: "3000+ MMR (Top 10 Only)",
                desc: "The ultimate achievement. Only the top 10 players by MMR hold X rank. Crown emoji for #1.",
                color: "bg-white/10 border-white/30 text-white"
              }
            ].map((rank) => (
              <div key={rank.rank} className={`p-8 rounded-2xl border-2 ${rank.color}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-3xl font-black">{rank.rank}</h3>
                  {rank.tier && <span className="text-sm font-medium text-white/60">{rank.tier}</span>}
                </div>
                <p className="text-white/80 mb-4">{rank.mmr}</p>
                <p className="text-sm text-white/60 leading-relaxed">{rank.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8">
            Ready to <span className="text-red-500">Climb?</span>
          </h2>
          <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto">
            Join #GRNDS on Discord, link your Riot ID, and start your journey from GRNDS to X rank.
          </p>
          <DiscordLoginButton />
          <p className="text-sm text-white/40 mt-8">
            Marvel Rivals features coming soon
          </p>
        </div>
      </section>
    </div>
  )
}
