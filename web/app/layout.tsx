import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "GRNDS Hub - Competitive Dashboard",
  description: "Your competitive home base for tracking rank, stats, and community activity",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="grain-overlay" />
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Link href="/" className="text-2xl font-black text-[#ffd700] tracking-tight">
                  GRNDS
                </Link>
                <div className="hidden md:flex items-center gap-6">
                  <Link 
                    href="/dashboard" 
                    className="text-sm font-medium text-gray-400 hover:text-[#ffd700] transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link 
                    href="/season" 
                    className="text-sm font-medium text-gray-400 hover:text-[#ffd700] transition-colors"
                  >
                    Season
                  </Link>
                  <Link 
                    href="/leaderboard" 
                    className="text-sm font-medium text-gray-400 hover:text-[#ffd700] transition-colors"
                  >
                    Leaderboard
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Link 
                  href="/auth/login"
                  className="px-4 py-2 text-sm font-semibold bg-[#ffd700] text-black rounded-lg hover:bg-[#ccaa00] transition-colors"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </nav>
        <main className="relative z-10 pt-16">
          {children}
        </main>
      </body>
    </html>
  );
}
