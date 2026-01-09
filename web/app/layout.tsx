import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { CursorReactiveBackground } from "@/components/CursorReactiveBackground";

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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased font-sans tracking-tight" suppressHydrationWarning>
        <CursorReactiveBackground />
        <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/5 bg-black/80 backdrop-blur-2xl transition-all duration-700 py-4 md:py-6">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <Link href="/" className="text-xl md:text-2xl font-black text-[#ff8c00] tracking-tighter">
                GRNDS
              </Link>
              <div className="hidden md:flex items-center gap-8">
                <Link 
                  href="/dashboard" 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-[#ff8c00] transition-colors relative group"
                >
                  Dashboard
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#ff8c00] transition-all group-hover:w-full" />
                </Link>
                <Link 
                  href="/season" 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-[#ff8c00] transition-colors relative group"
                >
                  Season
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#ff8c00] transition-all group-hover:w-full" />
                </Link>
                <Link 
                  href="/leaderboard" 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-[#ff8c00] transition-colors relative group"
                >
                  Leaderboard
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-[#ff8c00] transition-all group-hover:w-full" />
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                href="/auth/login"
                className="px-4 md:px-6 py-2 md:py-3 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] bg-[#ff8c00] text-black rounded-xl hover:bg-[#ff9500] transition-all shadow-xl"
              >
                Sign In
              </Link>
            </div>
          </div>
        </nav>
        <main className="relative z-10 pt-16 md:pt-20 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
