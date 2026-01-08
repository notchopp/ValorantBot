# Setup Guide

## Prerequisites

1. **Discord Bot Setup**
   - Create a Discord application at https://discord.com/developers/applications
   - Get your bot token and client ID
   - Invite bot to your server with appropriate permissions

2. **Supabase Setup**
   - Create account at https://supabase.com
   - Create a new project
   - Get your project URL and anon key from Settings > API

3. **Fly.io Account** (for deployment)
   - Sign up at https://fly.io
   - Install Fly CLI

## Database Setup

1. **Run Migration**
   - Go to Supabase Dashboard > SQL Editor
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and execute in SQL Editor

2. **Create Discord Rank Roles**
   - In your Discord server, create roles:
     - Iron
     - Bronze
     - Silver
     - Gold
     - Platinum
     - Diamond
     - Ascendant
     - Immortal
     - Radiant
   - Optionally update `rank_thresholds` table with role IDs:
   ```sql
   UPDATE rank_thresholds SET role_id = 'YOUR_ROLE_ID' WHERE rank = 'Iron';
   -- Repeat for each rank
   ```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Discord Bot Configuration
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID=your_guild_id_here

# Valorant API Configuration
VALORANT_API_ENABLED=true
VALORANT_DEFAULT_REGION=na

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

## Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build Project**
   ```bash
   npm run build
   ```

3. **Start Bot**
   ```bash
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Testing Commands

1. **Verify Account**
   ```
   /verify name:YourRiotName tag:YourTag region:na
   ```
   - This will verify your Riot ID
   - Assign initial Discord rank based on Valorant rank
   - Link your account

2. **Check Rank**
   ```
   /rank
   ```
   or
   ```
   /mmr
   ```
   - Shows your Discord rank
   - Current MMR
   - Progress to next rank

3. **View Stats**
   ```
   /stats
   ```
   - Shows player statistics

4. **View Leaderboard**
   ```
   /leaderboard
   ```
   - Shows top players by MMR

## Next Steps

- Set up Vercel functions for cloud agents (see `ARCHITECTURE_PLAN.md`)
- Configure auto role updates
- Set up match reporting system
- Deploy to Fly.io
