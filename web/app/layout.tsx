import type { Metadata } from "next";
import "./globals.css";
import { CursorReactiveBackground } from "@/components/CursorReactiveBackground";
import { GRNDSTopNavWrapper } from "@/components/GRNDSTopNavWrapper";

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
        <GRNDSTopNavWrapper />
        <main className="relative z-10 pt-20 md:pt-24 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
