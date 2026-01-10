import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SignupForm } from '@/components/SignupForm'

export default async function SignupPage() {
  const supabase = await createClient()
  
  // Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/auth/login?step=claim')
  }
  
  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-sans">
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h1 className="text-4xl font-black tracking-tighter mb-2">
              <span className="text-red-500">#GRNDS</span>
            </h1>
            <p className="text-white/60">Create an account to claim your profile</p>
          </div>

          <SignupForm />

          <p className="text-sm text-white/40 text-center">
            Already have an account?{' '}
            <a href="/auth/login" className="text-red-500 hover:text-red-400">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
