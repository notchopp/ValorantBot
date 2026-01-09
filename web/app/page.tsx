import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Hero Section */}
        <h1 className="text-7xl md:text-8xl font-black text-[#ffd700] mb-6 tracking-tight">
          GRNDS HUB
        </h1>
        <p className="text-2xl md:text-3xl text-gray-400 mb-4 font-light">
          Your Competitive Home Base
        </p>
        <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
          Track your rank, climb the leaderboard, and compete with the community.
          Your journey from GRNDS to X starts here.
        </p>
        
        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link 
            href="/dashboard"
            className="w-full sm:w-auto px-8 py-4 bg-[#ffd700] text-black font-black text-lg rounded-lg hover:bg-[#ccaa00] transition-colors"
          >
            View Dashboard
          </Link>
          <Link 
            href="/leaderboard"
            className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white font-bold text-lg rounded-lg hover:bg-white/10 transition-colors"
          >
            See Leaderboard
          </Link>
        </div>
        
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-black text-white mb-2">Personal Dashboard</h3>
            <p className="text-gray-400 text-sm">
              Track your MMR, rank progression, and competitive stats in real-time.
            </p>
          </div>
          
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-black text-white mb-2">Season Rankings</h3>
            <p className="text-gray-400 text-sm">
              Compete in seasonal leaderboards and earn your place among the elite.
            </p>
          </div>
          
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
            <div className="text-4xl mb-4">💬</div>
            <h3 className="text-xl font-black text-white mb-2">Community Hub</h3>
            <p className="text-gray-400 text-sm">
              Connect with players, track activity feeds, and share your journey.
            </p>
          </div>
        </div>
        
        {/* Rank System Preview */}
        <div className="mt-16 bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
          <h3 className="text-2xl font-black text-white mb-6">The Grind</h3>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex flex-col items-center">
              <span className="px-4 py-2 bg-orange-500 text-black font-black text-sm rounded-lg mb-2">
                GRNDS
              </span>
              <span className="text-xs text-gray-500">0-999 MMR</span>
            </div>
            <span className="text-gray-600 text-2xl">→</span>
            <div className="flex flex-col items-center">
              <span className="px-4 py-2 bg-black text-white border border-white/20 font-black text-sm rounded-lg mb-2">
                BREAKPOINT
              </span>
              <span className="text-xs text-gray-500">1000-1999 MMR</span>
            </div>
            <span className="text-gray-600 text-2xl">→</span>
            <div className="flex flex-col items-center">
              <span className="px-4 py-2 bg-red-600 text-white font-black text-sm rounded-lg mb-2">
                CHALLENGER
              </span>
              <span className="text-xs text-gray-500">2000-2999 MMR</span>
            </div>
            <span className="text-gray-600 text-2xl">→</span>
            <div className="flex flex-col items-center">
              <span className="px-4 py-2 bg-white text-black font-black text-sm rounded-lg mb-2">
                X
              </span>
              <span className="text-xs text-gray-500">Top 10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
