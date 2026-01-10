import type { Metadata } from "next";
import "./globals.css";
import { CursorReactiveBackground } from "@/components/CursorReactiveBackground";
import { GRNDSTopNavWrapper } from "@/components/GRNDSTopNavWrapper";
import { AuthAwareMain } from "@/components/AuthAwareMain";
import { AccentColorProvider } from "@/lib/AccentColorContext";

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
        <AccentColorProvider>
          <CursorReactiveBackground />
          <GRNDSTopNavWrapper />
          <AuthAwareMain>
            {children}
          </AuthAwareMain>
        </AccentColorProvider>
      </body>
    </html>
  );
}
