import type { Metadata } from "next";
import "./globals.css";
import { CursorReactiveBackground } from "@/components/CursorReactiveBackground";
import { GRNDSTopNavWrapper } from "@/components/GRNDSTopNavWrapper";
import { ConditionalMain } from "@/components/ConditionalMain";

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
        <ConditionalMain>
          {children}
        </ConditionalMain>
      </body>
    </html>
  );
}
