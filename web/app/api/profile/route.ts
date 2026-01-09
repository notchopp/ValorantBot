import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to edit your profile.' },
        { status: 401 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    const { discord_user_id, display_name, bio, favorite_agent, favorite_map } = body
    
    // Validate input
    if (!discord_user_id) {
      return NextResponse.json(
        { error: 'discord_user_id is required' },
        { status: 400 }
      )
    }
    
    // Verify user owns this profile
    const { data: userRecord } = await supabase
      .from('users')
      .select('discord_user_id')
      .eq('auth_id', user.id)
      .maybeSingle()
    
    if (!userRecord || userRecord.discord_user_id !== discord_user_id) {
      return NextResponse.json(
        { error: 'You can only edit your own profile' },
        { status: 403 }
      )
    }
    
    // Update or insert profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        discord_user_id,
        display_name: display_name?.trim() || null,
        bio: bio?.trim() || null,
        favorite_agent: favorite_agent?.trim() || null,
        favorite_map: favorite_map?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    
    if (profileError) {
      console.error('Error updating profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to update profile. Please try again.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(profile, { status: 200 })
  } catch (error) {
    console.error('Unexpected error in profile API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
