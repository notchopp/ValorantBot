import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { CursorReactiveBackground } from "@/components/CursorReactiveBackground";
import { AuthButton } from "@/components/AuthButton";
import { ProfileNav } from "@/components/ProfileNav";

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
        <nav className="fixed top-0 left-0 right-0 z-[100] border-b border-white/10 bg-[#1a1a1a]/90 backdrop-blur-2xl transition-all duration-700 py-3 md:py-4">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 flex items-center justify-between">
            <div className="flex items-center gap-6 md:gap-8">
              <Link href="/dashboard" className="text-lg md:text-xl font-black text-red-500 tracking-tighter">
                GRNDS
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link 
                  href="/dashboard" 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors relative group"
                >
                  Dashboard
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-red-500 transition-all group-hover:w-full" />
                </Link>
                <Link 
                  href="/season" 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors relative group"
                >
                  Season
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-red-500 transition-all group-hover:w-full" />
                </Link>
                <Link 
                  href="/leaderboard" 
                  className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 hover:text-white transition-colors relative group"
                >
                  Leaderboard
                  <span className="absolute -bottom-0.5 left-0 w-0 h-[1.5px] bg-red-500 transition-all group-hover:w-full" />
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ProfileNav />
              <AuthButton />
            </div>
          </div>
        </nav>
        <main className="relative z-10 pt-14 md:pt-16 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
