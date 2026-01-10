import { DiscordLoginButton } from '@/components/DiscordLoginButton'

export default async function LoginPage() {
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans flex items-center justify-center p-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h1 className="text-6xl font-black tracking-tighter mb-6">
            <span className="text-red-500">GRNDS</span>
          </h1>
        </div>

        <div className="space-y-6">
          <DiscordLoginButton />
        </div>
      </div>
    </div>
  )
}
