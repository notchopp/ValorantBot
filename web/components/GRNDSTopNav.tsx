"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, Trophy, Users, User, LogOut, Menu, X, Shield
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PlayerSearch } from "./PlayerSearch";
import { useAccentColor } from "@/lib/AccentColorContext";
import { NotificationsBell } from "./NotificationsBell";

type Tab = "dashboard" | "season" | "leaderboard" | "profile" | "hq";

interface GRNDSTopNavProps {
  discordUserId?: string;
  isAdmin?: boolean;
}

interface TabItem { 
  id: Tab; 
  label: string; 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>; 
  href: string;
  adminOnly?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabs: TabItem[] = [
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard as React.ComponentType<any>, href: "/dashboard" },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { id: "season", label: "Season", icon: Trophy as React.ComponentType<any>, href: "/season" },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { id: "leaderboard", label: "Leaderboard", icon: Users as React.ComponentType<any>, href: "/leaderboard" },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { id: "profile", label: "Profile", icon: User as React.ComponentType<any>, href: "" }, // href set dynamically
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { id: "hq", label: "HQ", icon: Shield as React.ComponentType<any>, href: "/hq", adminOnly: true },
];

export function GRNDSTopNav({ discordUserId, isAdmin = false }: GRNDSTopNavProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { accentColor } = useAccentColor();

  // Filter tabs based on admin status
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  // Determine active tab based on pathname
  const getActiveTab = (): Tab => {
    if (pathname?.startsWith("/dashboard")) return "dashboard";
    if (pathname?.startsWith("/season")) return "season";
    if (pathname?.startsWith("/leaderboard")) return "leaderboard";
    if (pathname?.startsWith("/profile")) return "profile";
    if (pathname?.startsWith("/hq")) return "hq";
    return "dashboard";
  };

  const activeTab = getActiveTab();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[100] px-2 sm:px-4 md:px-6 pt-4 sm:pt-6 pb-2 sm:pb-4">
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-[1920px] mx-auto flex items-center justify-between px-2 sm:px-4 md:px-8 py-2 sm:py-3 rounded-lg sm:rounded-xl border border-white/20 bg-black/80 backdrop-blur-xl shadow-2xl font-mono"
        style={{ boxShadow: `0 0 30px ${accentColor}10, inset 0 1px 0 rgba(255,255,255,0.05)` }}
      >
        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 rounded-xl bg-white/5 border border-white/5 transition-all"
          style={{ '--accent-color': accentColor } as React.CSSProperties}
        >
          <Menu className="w-5 h-5 text-white/60 hover:text-[var(--accent-color)] transition-colors" />
        </button>

        {/* Logo & Brand - Terminal Style */}
        <Link href="/dashboard" className="flex items-center gap-2 sm:gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="relative cursor-pointer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="/grnds-logo-3d.gif" 
              alt="GRNDS" 
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
            />
          </motion.div>
          <div className="hidden sm:flex items-center gap-2 font-mono">
            <span className="text-white/30">$</span>
            <span className="text-xs sm:text-sm font-bold tracking-tight uppercase" style={{ color: accentColor }}>grnds</span>
            <span className="text-white/30">--hub</span>
            <span className="animate-pulse text-white/60">_</span>
          </div>
        </Link>

        {/* Tab Navigation - Desktop - Terminal Style */}
        <div className="hidden md:flex items-center gap-3 flex-1 max-w-4xl mx-4 md:mx-8">
          {/* Search */}
          <div className="flex-1 max-w-xs">
            <PlayerSearch />
          </div>
          
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const href = tab.id === "profile" && discordUserId ? `/profile/${discordUserId}` : tab.href;

            return (
              <Link
                key={tab.id}
                href={href}
                className="relative flex items-center gap-2 px-3 py-2 rounded-md transition-all flex-1 justify-center group"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-md border"
                    style={{ 
                      backgroundColor: `${accentColor}15`,
                      borderColor: `${accentColor}40`
                    }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="text-white/30 relative z-10">[</span>
                <Icon className={`w-3 h-3 relative z-10 transition-colors ${isActive ? "" : "text-white/40 group-hover:text-white/60"}`} style={isActive ? { color: accentColor } : undefined} />
                <span className={`text-[9px] font-bold uppercase tracking-wide relative z-10 transition-colors font-mono ${isActive ? "" : "text-white/40 group-hover:text-white/60"}`} style={isActive ? { color: accentColor } : undefined}>
                  {tab.label}
                </span>
                <span className="text-white/30 relative z-10">]</span>
              </Link>
            );
          })}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block h-6 w-px bg-white/10 mx-1" />
          <NotificationsBell />
          <motion.button
            onClick={handleSignOut}
            whileHover={{ scale: 1.05 }}
            className="flex items-center gap-2 p-2 sm:px-4 sm:py-2 rounded-xl bg-white/5 border border-white/5 transition-all group"
            style={{ '--accent-color': accentColor } as React.CSSProperties}
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/40 group-hover:text-[var(--accent-color)] transition-colors" />
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-widest text-white/40 group-hover:text-red-400 transition-colors">
              Sign Out
            </span>
          </motion.button>
        </div>
      </motion.div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[110]"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-black border-r border-white/10 p-8 z-[120] glass-strong"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3 font-mono">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/grnds-logo-3d.gif" 
                    alt="GRNDS" 
                    className="w-8 h-8 object-contain"
                  />
                  <span className="text-white/30">$</span>
                  <span className="text-sm font-bold tracking-tight uppercase" style={{ color: accentColor }}>grnds</span>
                </div>
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-2 rounded-lg hover:bg-white/5 text-white/40 transition-colors border border-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                {/* Search in Mobile */}
                <div className="px-2">
                  <PlayerSearch />
                </div>
                
                <div className="space-y-2">
                  {visibleTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    const href = tab.id === "profile" && discordUserId ? `/profile/${discordUserId}` : tab.href;
                    
                    return (
                      <Link
                        key={tab.id}
                        href={href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${
                          isActive 
                            ? "" 
                            : "text-white/40 hover:bg-white/5 hover:text-white/60"
                        }`}
                        style={isActive ? { 
                          backgroundColor: `${accentColor}1a`,
                          border: `1px solid ${accentColor}4d`,
                          color: accentColor
                        } : undefined}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">{tab.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="mt-auto pt-8 border-t border-white/5">
                <button 
                  onClick={handleSignOut} 
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-widest">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
