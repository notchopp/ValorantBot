import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen relative bg-black text-white selection:bg-[#ffd700] selection:text-black font-sans tracking-tight">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-24 md:pt-32 px-4 md:px-8">
        <div className="max-w-[1400px] mx-auto w-full relative z-10">
          <div className="text-center md:text-left">
            <div className="mb-6 md:mb-10 inline-flex items-center gap-3 md:gap-4">
              <div className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full glass border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff8c00] animate-pulse shadow-[0_0_10px_rgba(255,140,0,0.8)]" />
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] md:tracking-[0.3em] text-white/80">
                  Competitive Hub Live
                </span>
              </div>
            </div>
            
            <h1 className="text-5xl sm:text-6xl md:text-8xl lg:text-[11rem] font-black leading-[0.9] tracking-[-0.02em] mb-6 md:mb-8 cursor-default select-none">
              GRNDS
              <br />
              <span className="text-[#ff8c00] italic">HUB</span>
            </h1>

            <p className="text-[#ff8c00] text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] md:tracking-[0.5em] mb-6 md:mb-8 block text-center md:text-left">
              Making ranked fun again, one game at a time
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-end">
              <div className="md:col-span-7">
                <p className="text-lg sm:text-xl md:text-3xl text-white/60 font-light leading-snug mb-8 md:mb-12 text-balance text-center md:text-left">
                  Your competitive home base for tracking rank, stats, and community activity. Climb from GRNDS to X rank and compete with the best.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center md:justify-start">
                  <Link
                    href="/dashboard"
                    className="group relative px-8 md:px-12 py-4 md:py-6 bg-[#ff8c00] rounded-2xl flex items-center justify-center gap-3 md:gap-4 overflow-hidden shadow-2xl shadow-[#ff8c00]/30 hover:bg-[#ff9500] transition-all duration-300"
                  >
                    <svg className="w-5 h-5 md:w-6 md:h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-black font-black uppercase tracking-widest text-xs md:text-sm">View Dashboard</span>
                  </Link>
                  
                  <Link
                    href="/leaderboard"
                    className="px-8 md:px-12 py-4 md:py-6 rounded-2xl border border-white/10 glass flex items-center justify-center gap-3 md:gap-4 hover:bg-white/[0.05] hover:border-[#ff8c00]/30 transition-all duration-300"
                  >
                    <span className="text-white font-black uppercase tracking-widest text-xs md:text-sm">See Leaderboard</span>
                  </Link>
                </div>
              </div>
              
              <div className="md:col-span-5 flex flex-col justify-center gap-6 md:gap-8 md:border-l border-white/10 md:pl-12">
                {[
                  { label: "Players Tracked", value: "Real-Time", icon: "Users" },
                  { label: "Matches Logged", value: "Live", icon: "Target" },
                  { label: "Rank System", value: "Custom", icon: "Trophy" }
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between group cursor-default">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl glass border border-white/10 flex items-center justify-center">
                        {stat.icon === "Users" && (
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-[#ff8c00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        )}
                        {stat.icon === "Target" && (
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-[#ff0000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {stat.icon === "Trophy" && (
                          <svg className="w-4 h-4 md:w-5 md:h-5 text-[#ffd700]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] text-white/40">{stat.label}</span>
                    </div>
                    <span className="text-lg md:text-xl font-black tracking-tight text-white">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 md:py-40 px-4 md:px-8 relative z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-12 md:mb-24">
            <span className="text-[#ff8c00] text-[9px] md:text-[10px] font-black uppercase tracking-[0.35em] md:tracking-[0.4em] mb-4 md:mb-6 block">Features</span>
            <h2 className="text-4xl sm:text-5xl md:text-8xl font-black tracking-tighter leading-tight mb-6 md:mb-8 uppercase px-4">
              COMPETITIVE
              <br />
              <span className="text-white/20">TRACKING.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                title: "Personal Dashboard",
                desc: "Track your MMR, rank progression, and competitive stats in real-time. See your journey from GRNDS to X rank.",
                gradient: "from-[#ff8c00]/10 to-transparent",
                iconColor: "#ff8c00"
              },
              {
                title: "Season Rankings",
                desc: "Compete in seasonal leaderboards and earn your place among the elite. Top 10 players achieve X rank status.",
                gradient: "from-[#ff0000]/10 to-transparent",
                iconColor: "#ff0000"
              },
              {
                title: "Community Hub",
                desc: "Connect with players, track activity feeds, and share your journey. Comments, stats, and real-time updates.",
                gradient: "from-[#ffd700]/10 to-transparent",
                iconColor: "#ffd700"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group p-8 md:p-10 rounded-[2rem] md:rounded-[3rem] glass border border-white/5 hover:border-[#ff8c00]/30 transition-all duration-500"
              >
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} border border-white/10 flex items-center justify-center mb-6 md:mb-8`}>
                  <svg className="w-6 h-6 md:w-7 md:h-7" style={{ color: feature.iconColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight mb-3 md:mb-4 uppercase">{feature.title}</h3>
                <p className="text-base md:text-lg text-white/40 font-light leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rank System */}
      <section className="py-20 md:py-40 px-4 md:px-8 relative z-10">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-24 items-center">
            <div className="lg:col-span-6">
              <span className="text-[#ff8c00] text-[9px] md:text-[10px] font-black uppercase tracking-[0.35em] md:tracking-[0.4em] mb-4 md:mb-6 block">The Rank System</span>
              <h2 className="text-4xl sm:text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 md:mb-12 uppercase">
                CLIMB FROM
                <br />
                <span className="text-white/20">GRNDS TO X.</span>
              </h2>
              <p className="text-xl md:text-2xl text-white/40 font-light leading-relaxed mb-8">
                Four competitive tiers. Real MMR tracking. Only the top 10 players reach X rank. Every match matters.
              </p>
            </div>
            <div className="lg:col-span-6 space-y-4 md:space-y-6">
              {[
                { rank: "GRNDS I-V", mmr: "0-999 MMR", color: "bg-[#ff8c00] text-black border-[#ff8c00]" },
                { rank: "BREAKPOINT I-V", mmr: "1000-1999 MMR", color: "bg-black border-2 border-white/30 text-white" },
                { rank: "CHALLENGER I-V", mmr: "2000-2999 MMR", color: "bg-[#ff0000] text-white border-[#ff0000]" },
                { rank: "X RANK", mmr: "3000+ MMR (Top 10)", color: "bg-white text-black border-white" }
              ].map((tier, i) => (
                <div
                  key={i}
                  className={`p-6 md:p-8 rounded-2xl ${tier.color} border transition-all duration-300 hover:scale-[1.02]`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xl md:text-2xl font-black tracking-tight mb-1">{tier.rank}</div>
                      <div className="text-sm md:text-base opacity-80 font-light">{tier.mmr}</div>
                    </div>
                    {i === 3 && (
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black/20 flex items-center justify-center">
                        <svg className="w-6 h-6 md:w-7 md:h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-40 px-4 md:px-8 relative z-10 border-t border-white/5">
        <div className="max-w-[1400px] mx-auto text-center">
          <p className="text-sm md:text-base text-white/40 font-light mb-6 md:mb-8 uppercase tracking-widest">
            Marvel Rivals Features Coming Soon
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-8 md:px-12 py-4 md:py-6 bg-[#ff8c00] rounded-2xl text-black font-black uppercase tracking-widest text-xs md:text-sm hover:bg-[#ff9500] transition-all duration-300 shadow-2xl shadow-[#ff8c00]/30"
          >
            Get Started Now
          </Link>
        </div>
      </section>
    </main>
  );
}
