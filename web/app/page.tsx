import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen relative bg-black text-white font-sans tracking-tight">
      {/* Hero - What is GRNDS */}
      <section className="relative min-h-screen flex items-center pt-32 md:pt-40 px-4 md:px-8">
        <div className="max-w-[1200px] mx-auto w-full relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-8">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500">
                Competitive Ranked System
              </span>
            </div>
            
            <h1 className="text-6xl sm:text-7xl md:text-9xl font-black leading-[0.85] tracking-tighter mb-8">
              <span className="text-yellow-500">#GRNDS</span>
            </h1>
            
            <p className="text-2xl md:text-4xl font-light text-white/70 mb-12 max-w-3xl mx-auto leading-relaxed">
              Custom ranked system for Valorant. Real MMR tracking. Climb from GRNDS to X rank.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-20">
              <Link
                href="/dashboard"
                className="px-10 py-5 bg-yellow-500 text-black font-black uppercase tracking-wider text-sm rounded-xl hover:bg-yellow-400 transition-all shadow-2xl shadow-yellow-500/30"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/leaderboard"
                className="px-10 py-5 border-2 border-white/20 bg-white/5 rounded-xl font-black uppercase tracking-wider text-sm hover:bg-white/10 hover:border-yellow-500/50 transition-all"
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
                <div className="text-2xl font-black text-yellow-500 mb-2">{stat.value}</div>
                <div className="text-xs font-medium uppercase tracking-wider text-white/40">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - The GRNDS System */}
      <section className="py-32 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              How <span className="text-yellow-500">#GRNDS</span> Works
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              A complete custom ranked system built for competitive Valorant. Here&apos;s how it works.
            </p>
          </div>

          <div className="space-y-8 mb-20">
            {/* Step 1 */}
            <div className="p-10 rounded-3xl bg-white/[0.02] border border-white/5">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-black text-yellow-500">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black mb-4">Link Your Riot ID</h3>
                  <p className="text-lg text-white/60 leading-relaxed mb-4">
                    Connect your Valorant account using <code className="px-2 py-1 bg-black/50 rounded text-yellow-500 text-sm">/riot link</code> in Discord. 
                    Your account is verified and ready to compete.
                  </p>
                  <p className="text-sm text-white/40 italic">
                    We track your Valorant MMR and match history automatically.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-10 rounded-3xl bg-white/[0.02] border border-white/5">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-black text-yellow-500">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black mb-4">Get Verified & Placed</h3>
                  <p className="text-lg text-white/60 leading-relaxed mb-4">
                    Run <code className="px-2 py-1 bg-black/50 rounded text-yellow-500 text-sm">/verify</code> to get your initial rank placement. 
                    You&apos;ll start at GRNDS I and begin your climb.
                  </p>
                  <p className="text-sm text-white/40 italic">
                    Your starting MMR is calculated from your current Valorant rank and stats.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-10 rounded-3xl bg-white/[0.02] border border-white/5">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-black text-yellow-500">3</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black mb-4">Join the Queue</h3>
                  <p className="text-lg text-white/60 leading-relaxed mb-4">
                    Use <code className="px-2 py-1 bg-black/50 rounded text-yellow-500 text-sm">/queue join</code> to enter matchmaking. 
                    When 10 players are ready, teams are balanced and the match begins.
                  </p>
                  <p className="text-sm text-white/40 italic">
                    Teams are automatically balanced by MMR. Fair matches, every time.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-10 rounded-3xl bg-white/[0.02] border border-white/5">
              <div className="flex items-start gap-6">
                <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-black text-yellow-500">4</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-black mb-4">Play & Report</h3>
                  <p className="text-lg text-white/60 leading-relaxed mb-4">
                    Play your match. The host confirms the game, then use <code className="px-2 py-1 bg-black/50 rounded text-yellow-500 text-sm">/match report</code> to submit results. 
                    MMR updates automatically based on win/loss and performance.
                  </p>
                  <p className="text-sm text-white/40 italic">
                    MVP performances and big wins earn bonus MMR. Every match matters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Rank System */}
      <section className="py-32 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              The <span className="text-yellow-500">Rank</span> System
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12">
              Four competitive tiers. Real MMR tracking. Climb from GRNDS to X rank.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* GRNDS */}
            <div className="p-8 rounded-2xl bg-yellow-500/10 border-2 border-yellow-500/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-3xl font-black text-yellow-500">GRNDS</h3>
                <span className="text-sm font-medium text-white/60">I - V</span>
              </div>
              <p className="text-white/80 mb-4">0 - 999 MMR</p>
              <p className="text-sm text-white/60 leading-relaxed">
                Starting rank. Every player begins here. Learn the system, improve, and climb.
              </p>
            </div>

            {/* BREAKPOINT */}
            <div className="p-8 rounded-2xl bg-white/[0.02] border-2 border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-3xl font-black text-white">BREAKPOINT</h3>
                <span className="text-sm font-medium text-white/60">I - V</span>
              </div>
              <p className="text-white/80 mb-4">1000 - 1999 MMR</p>
              <p className="text-sm text-white/60 leading-relaxed">
                You&apos;ve proven yourself. Competitive matches await. Push for CHALLENGER.
              </p>
            </div>

            {/* CHALLENGER */}
            <div className="p-8 rounded-2xl bg-red-500/10 border-2 border-red-500/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-3xl font-black text-red-500">CHALLENGER</h3>
                <span className="text-sm font-medium text-white/60">I - V</span>
              </div>
              <p className="text-white/80 mb-4">2000 - 2999 MMR</p>
              <p className="text-sm text-white/60 leading-relaxed">
                Elite tier. Top players compete here. Only the best reach 3000+ MMR.
              </p>
            </div>

            {/* X RANK */}
            <div className="p-8 rounded-2xl bg-white/10 border-2 border-white/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-3xl font-black text-white">X RANK</h3>
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <p className="text-white/80 mb-4">3000+ MMR (Top 10 Only)</p>
              <p className="text-sm text-white/60 leading-relaxed">
                The ultimate achievement. Only the top 10 players by MMR hold X rank. Crown for #1.
              </p>
            </div>
          </div>

          <div className="text-center p-8 rounded-2xl bg-yellow-500/5 border border-yellow-500/20">
            <p className="text-white/80 mb-2">
              <strong className="text-yellow-500">Note:</strong> X rank is dynamic. You must maintain your position in the top 10.
            </p>
            <p className="text-sm text-white/60">
              If you drop out of top 10, you&apos;re demoted to CHALLENGER V. Climb back up to reclaim X rank.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-6">
              What You Get
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Personal Dashboard",
                desc: "Track your MMR, rank progression, win rate, and competitive stats in real-time. See exactly where you are in the climb.",
                icon: "Dashboard"
              },
              {
                title: "Season Rankings",
                desc: "Compete in seasonal leaderboards. Top 10 players achieve X rank status. Watch the race to the top.",
                icon: "Trophy"
              },
              {
                title: "Community Hub",
                desc: "Connect with players, see activity feeds, share your journey. Comments, stats, and real-time updates.",
                icon: "Users"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-yellow-500/30 transition-all"
              >
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-4">
                  {feature.icon === "Dashboard" && (
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )}
                  {feature.icon === "Trophy" && (
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  )}
                  {feature.icon === "Users" && (
                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-black mb-3">{feature.title}</h3>
                <p className="text-white/60 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1200px] mx-auto text-center">
          <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8">
            Ready to <span className="text-yellow-500">Climb?</span>
          </h2>
          <p className="text-xl text-white/60 mb-12 max-w-2xl mx-auto">
            Join #GRNDS on Discord, link your Riot ID, and start your journey from GRNDS to X rank.
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-12 py-6 bg-yellow-500 text-black font-black uppercase tracking-wider text-sm rounded-xl hover:bg-yellow-400 transition-all shadow-2xl shadow-yellow-500/30"
          >
            Go to Dashboard
          </Link>
          <p className="text-sm text-white/40 mt-8">
            Marvel Rivals features coming soon
          </p>
        </div>
      </section>
    </main>
  );
}
