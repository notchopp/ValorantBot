export async function AuthAwareMain({ children }: { children: React.ReactNode }) {
  // Content flows naturally inside the terminal shell
  return (
    <main className="relative z-10 min-h-screen">
      {children}
    </main>
  )
}
