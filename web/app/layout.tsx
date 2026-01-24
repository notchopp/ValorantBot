import type { Metadata } from "next";
import "./globals.css";
import { AuthAwareMain } from "@/components/AuthAwareMain";
import { AccentColorProvider } from "@/lib/AccentColorContext";
import { InitiationWrapper } from "@/components/InitiationWrapper";
import { Terminal3DShellWrapper } from "@/components/Terminal3DShellWrapper";

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
          <InitiationWrapper>
            <Terminal3DShellWrapper>
              <AuthAwareMain>
                {children}
              </AuthAwareMain>
            </Terminal3DShellWrapper>
          </InitiationWrapper>
        </AccentColorProvider>
      </body>
    </html>
  );
}
