# GRNDS Community Hub - Setup and Deployment Guide

This guide covers setting up the GRNDS web application from scratch, including database setup, configuration, and deployment.

## Prerequisites

- Node.js 20+ installed
- A Supabase account and project
- Basic knowledge of Next.js and PostgreSQL

## Part 1: Database Setup

### 1.1 Apply Migrations

In your Supabase project's SQL Editor, run the migrations in order:

1. **Initial Schema** (`supabase/migrations/001_initial_schema.sql`)
   - Creates players, matches, rank_history, and queue tables
   - Sets up rank thresholds for GRNDS, BREAKPOINT, CHALLENGER, X

2. **Host Fields** (`supabase/migrations/002_add_host_fields.sql`)
   - Adds host tracking to matches

3. **Web Features** (`supabase/migrations/003_add_web_features.sql`)
   - Adds seasons, activity_feed, comments tables
   - Creates profanity filtering function
   - Sets up Row Level Security policies
   - Adds automatic triggers for activity feed

### 1.2 Verify Tables

After running migrations, verify these tables exist:
- `players`
- `matches`
- `match_player_stats`
- `rank_history`
- `rank_thresholds`
- `queue`
- `seasons`
- `activity_feed`
- `comments`

### 1.3 Create a Season

The migration automatically creates "Season 1: Ignition". To create additional seasons:

```sql
INSERT INTO seasons (name, description, start_date, end_date, is_active)
VALUES (
    'Season 2: Ascension',
    'The second competitive season',
    '2024-04-01',
    '2024-06-30',
    FALSE
);
```

Make sure only one season is `is_active = TRUE` at a time.

## Part 2: Web Application Setup

### 2.1 Install Dependencies

```bash
cd web
npm install
```

### 2.2 Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Where to find these values:**
- `SUPABASE_URL`: Supabase Dashboard → Settings → API → Project URL
- `SUPABASE_ANON_KEY`: Supabase Dashboard → Settings → API → Project API keys → anon public

### 2.3 Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000 to see the app.

### 2.4 Build for Production

```bash
npm run build
npm start
```

## Part 3: Features Overview

### Pages

1. **Landing Page** (`/`)
   - Overview of the rank system
   - Links to dashboard and leaderboard

2. **Dashboard** (`/dashboard`)
   - Personal MMR and rank display
   - Progress bar to next rank
   - Season stats (matches, win rate, net MMR)
   - Recent activity feed

3. **Season** (`/season`)
   - Current season info with countdown
   - Top 10 players (X rank)
   - X Watch panel (players 11-20)
   - Season discussion comments

4. **Leaderboard** (`/leaderboard`)
   - Global player rankings
   - Sortable by MMR
   - Shows rank badges and peak MMR

5. **Profile** (`/profile/[userId]`)
   - Player stats and MMR progress
   - Rank journey timeline
   - Activity feed
   - Profile comments

### Components

- **RankBadge**: Displays rank with color coding
- **MMRProgressBar**: Animated progress bar showing distance to next rank
- **StatCard**: Reusable stat display with trends
- **ActivityFeed**: Shows rank-ups, MVPs, big MMR swings
- **CommentSection**: Comments UI with profanity filtering
- **SeasonCountdown**: Live countdown timer

## Part 4: Database Features

### Automatic Activity Tracking

The database automatically creates activity feed entries for:

1. **Rank Changes** - When a player ranks up or down
2. **Big MMR Gains** - When a player gains 30+ MMR in one match
3. **Big MMR Losses** - When a player loses 20+ MMR in one match
4. **MVP Performances** - When a player gets MVP in a match

These are triggered by database triggers on `rank_history` and `match_player_stats` tables.

### Profanity Filtering

Comments are automatically censored using the `censor_comment()` function.

**Allowed words**: fuck, shit, damn, hell, crap, ass
**Censored words**: nigger, nigga, faggot, fag, retard, chink, spic, kike, tranny, cunt, whore, slut

The `content_censored` field always contains the filtered version.

### Row Level Security

All tables have RLS policies:
- **Seasons**: Read-only for everyone
- **Activity Feed**: Read-only for everyone
- **Comments**: 
  - Everyone can read
  - Authenticated users can create
  - Users can only update/delete their own comments

## Part 5: Discord OAuth Setup (Future)

To enable authentication:

### 5.1 Create Discord OAuth App

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application
3. Go to OAuth2 settings
4. Add redirect URL: `https://your-project.supabase.co/auth/v1/callback`
5. Copy Client ID and Client Secret

### 5.2 Configure Supabase Auth

In Supabase Dashboard → Authentication → Providers:

1. Enable Discord provider
2. Enter Discord Client ID
3. Enter Discord Client Secret
4. Save

### 5.3 Update Web App

Create auth pages:
- `/app/auth/login/page.tsx` - Discord login button
- `/app/auth/callback/route.ts` - Handle OAuth callback

Example login:
```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'discord',
})
```

## Part 6: API Routes for Comments (Future)

Create API route for comment submission:

**`app/api/comments/route.ts`**
```typescript
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { content, target_type, target_id } = await request.json()
  
  // Rate limiting check (implement with Redis or similar)
  
  // Get player by discord_user_id
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('discord_user_id', user.id)
    .single()
  
  if (!player) {
    return Response.json({ error: 'Player not found' }, { status: 404 })
  }
  
  const { data, error } = await supabase
    .from('comments')
    .insert({
      author_id: player.id,
      target_type,
      target_id,
      content,
    })
    .select()
    .single()
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  
  return Response.json(data)
}
```

## Part 7: Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set root directory to `web`
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

### Deploy to Other Platforms

The app can be deployed to:
- **Netlify**: Set base directory to `web`
- **Cloudflare Pages**: Set build directory to `web`
- **Self-hosted**: Use `npm run build && npm start`

## Part 8: Testing

### Test Data

To test the app, you need some player data. You can:

1. Use the Discord bot to create players via `/verify` command
2. Manually insert test data:

```sql
INSERT INTO players (discord_user_id, discord_username, current_mmr, peak_mmr, discord_rank)
VALUES 
  ('123456789', 'TestPlayer1', 1500, 1600, 'BREAKPOINT III'),
  ('987654321', 'TestPlayer2', 2300, 2400, 'CHALLENGER II'),
  ('111222333', 'TestPlayer3', 850, 900, 'GRNDS V');
```

### Test Scenarios

1. **View Dashboard**: Should show top player's stats
2. **View Leaderboard**: Should list all players by MMR
3. **View Season**: Should show current season with countdown
4. **View Profile**: Navigate to `/profile/123456789` (use a real discord_user_id)
5. **Comments**: Comment UI should render (posting requires auth)

## Part 9: Troubleshooting

### Build Errors

**Error**: `No build cache found`
- This is a warning, not an error. It only affects build speed.

**Error**: `NEXT_PUBLIC_SUPABASE_URL is not defined`
- Make sure `.env.local` exists in the `web` directory
- Restart the dev server after creating `.env.local`

### Database Errors

**Error**: `relation "seasons" does not exist`
- Run migration `003_add_web_features.sql`

**Error**: `No active season found`
- Insert a season with `is_active = TRUE`

### Page Errors

**Error**: `No player data found`
- Make sure you have players in the database
- Check that `discord_user_id` matches the URL parameter

## Part 10: Future Enhancements

### Planned Features

- [ ] Real-time updates with Supabase subscriptions
- [ ] Match detail pages with full stats
- [ ] Friends list based on Discord connections
- [ ] User settings page
- [ ] Season history view
- [ ] Advanced stats and graphs
- [ ] Mobile app (React Native)

### Performance Optimizations

- [ ] Add Redis caching for leaderboard
- [ ] Implement incremental static regeneration
- [ ] Add image optimization for profile pictures
- [ ] Implement infinite scroll for comments

## Support

For issues or questions:
- Check the existing documentation in the repository
- Review Supabase logs for database errors
- Check browser console for client-side errors

---

Built with ❤️ for the GRNDS community.
