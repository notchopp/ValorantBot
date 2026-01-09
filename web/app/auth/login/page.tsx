import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  const supabase = await createClient()
  
  // Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  }
  
  
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/[0.02] border border-white/5 rounded-xl p-8 backdrop-blur-xl">
        <h1 className="text-4xl font-black text-white mb-2">Sign In</h1>
        <p className="text-gray-400 mb-8">
          Connect with Discord to post comments and track your progress
        </p>
        
        <div className="space-y-4">
          {/* Discord OAuth Button (Placeholder) */}
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-4">
              Discord OAuth integration is coming soon!
            </p>
            <p className="text-xs text-gray-500 mb-4">
              To enable authentication:
            </p>
            <ol className="text-xs text-gray-500 space-y-2 list-decimal list-inside mb-4">
              <li>Create a Discord OAuth app in Discord Developer Portal</li>
              <li>Configure Supabase Auth with Discord provider</li>
              <li>Add redirect URL to Discord app settings</li>
              <li>Update this page with Discord OAuth flow</li>
            </ol>
            <button
              disabled
              className="w-full px-4 py-3 bg-[#5865F2] text-white font-semibold rounded-lg opacity-50 cursor-not-allowed"
            >
              Sign in with Discord (Not Configured)
            </button>
          </div>
          
          <div className="text-center pt-4 border-t border-white/5">
            <Link
              href="/"
              className="text-sm text-gray-400 hover:text-[#ffd700] transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
