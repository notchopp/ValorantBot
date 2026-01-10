import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
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
    const { discord_user_id, display_name, bio, favorite_agent, favorite_map, accent_color } = body
    
    // Validate input with security limits
    if (!discord_user_id) {
      return NextResponse.json(
        { error: 'discord_user_id is required' },
        { status: 400 }
      )
    }
    
    // Validate length limits (security)
    if (display_name && display_name.length > 32) {
      return NextResponse.json(
        { error: 'Display name must be 32 characters or less' },
        { status: 400 }
      )
    }
    
    if (bio && bio.length > 200) {
      return NextResponse.json(
        { error: 'Bio must be 200 characters or less' },
        { status: 400 }
      )
    }
    
    if (favorite_agent && favorite_agent.length > 20) {
      return NextResponse.json(
        { error: 'Favorite agent must be 20 characters or less' },
        { status: 400 }
      )
    }
    
    if (favorite_map && favorite_map.length > 20) {
      return NextResponse.json(
        { error: 'Favorite map must be 20 characters or less' },
        { status: 400 }
      )
    }
    
    // Validate accent color (hex format)
    if (accent_color && !/^#[0-9A-Fa-f]{6}$/.test(accent_color)) {
      return NextResponse.json(
        { error: 'Accent color must be a valid hex color (e.g., #ef4444)' },
        { status: 400 }
      )
    }
    
    // Verify user owns this profile (use admin client for this check)
    const supabaseAdmin = getSupabaseAdminClient()
    
    // Check if player exists with this auth UID and matches the discord_user_id
    const { data: player } = await supabaseAdmin
      .from('players')
      .select('id, discord_user_id')
      .eq('id', user.id)
      .maybeSingle() as { data: { id: string; discord_user_id: string } | null }
    
    if (!player || player.discord_user_id !== discord_user_id) {
      return NextResponse.json(
        { error: 'You can only edit your own profile' },
        { status: 403 }
      )
    }
    
    // Update or insert profile (use admin client)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabaseAdmin.from('user_profiles') as any)
      .upsert({
        discord_user_id,
        display_name: display_name?.trim() || null,
        bio: bio?.trim() || null,
        favorite_agent: favorite_agent?.trim() || null,
        favorite_map: favorite_map?.trim() || null,
        accent_color: accent_color || '#ef4444',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'discord_user_id'
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
