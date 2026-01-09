import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Redirect to the requested page or dashboard
      const redirectUrl = new URL(next, requestUrl.origin)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // If there's an error, redirect back to login
  const loginUrl = new URL('/auth/login', requestUrl.origin)
  loginUrl.searchParams.set('error', 'oauth_error')
  return NextResponse.redirect(loginUrl)
}
