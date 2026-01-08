# Enhanced Architecture Plan

## Overview
A hybrid system using Fly.io (always-on bot), Vercel (cloud agents), Supabase (database), and Discord roles for a server-specific ranking system.

## Core Concept

1. **Initial Placement**: Valorant API rank → Discord role assignment
2. **Ongoing Ranks**: Discord rank system based on server matches (wins/losses/MVPs)
3. **Rank Updates**: Automatic Discord role updates based on weighted scores
4. **AI Analytics**: Cloud agents analyze match data for insights

---

## Architecture Components

### 1. Fly.io (Always-On Discord Bot)
**Purpose:** Persistent gateway connection for slash commands and real-time Discord interactions

**Responsibilities:**
- Handle all slash commands (`/verify`, `/queue`, `/rank`, `/mmr`, etc.)
- Manage Discord role assignments
- Listen for Discord events (button clicks, modals)
- Webhook receiver from Vercel for rank updates
- Queue state management (can also be in Supabase)

**Key Commands:**
- `/verify <riot_name> <riot_tag>` - Verify account, assign initial rank role
- `/rank` - Show Discord rank, MMR, progression
- `/mmr` - Same as rank (alias)
- `/queue join/leave/status` - Queue management
- `/match report` - Report match results
- `/stats` - Player statistics
- `/leaderboard` - Server leaderboard
- `/why am i losing so much` - AI analytics (triggers Vercel function)

---

### 2. Vercel (Cloud Agents / Serverless Functions)
**Purpose:** Heavy computation, queue processing, AI analytics, rank calculations

**Functions:**

#### A. Rank Calculation Service
**Endpoint:** `POST /api/calculate-rank`
**Trigger:** After match reporting or scheduled batch
**Function:**
- Fetch match data from Supabase
- Calculate weighted scores based on:
  - Win/Loss (+/- points)
  - K/D ratio
  - MVP status
  - Performance metrics from match details
- Update player MMR/rank in Supabase
- Return new rank to Fly.io bot (via webhook)

**Weighted Score Formula:**
```typescript
basePoints = win ? +25 : -10
mvpBonus = mvp ? +5 : 0
performanceMultiplier = calculateFromKD(damage, clutches)
finalPoints = (basePoints + mvpBonus) * performanceMultiplier
newMMR = currentMMR + finalPoints
```

#### B. Queue Processor
**Endpoint:** `POST /api/process-queue`
**Trigger:** When queue hits 10 players (called from Fly.io)
**Function:**
- Fetch all queued players from Supabase
- Get Discord ranks (MMR) for each player
- Run team balancing algorithm (auto or captain mode)
- Generate match
- Save to Supabase
- Return match details to Fly.io bot
- Fly.io bot posts match announcement in Discord

#### C. AI Analytics Agent
**Endpoint:** `POST /api/analyze-performance`
**Trigger:** `/why am i losing so much` command
**Function:**
- Fetch player's recent matches from Supabase
- Analyze patterns:
  - Win rate trends
  - K/D trends
  - Map performance
  - Agent performance
  - Common loss factors
- Optionally fetch Valorant API match details for deeper analysis
- Generate insights (AI or rule-based)
- Return formatted response to Discord

**Analysis Sources:**
- **Custom Matches**: Server matches from Supabase
- **Valorant Matches**: Official matches via API (if Riot ID linked)

#### D. Rank Verification Service
**Endpoint:** `POST /api/verify-account`
**Trigger:** `/verify` command
**Function:**
- Call Valorant API to verify account exists
- Fetch current Valorant rank
- Determine initial Discord rank role
- Create player record in Supabase
- Return verification result to Fly.io bot

---

### 3. Supabase (Database)
**Purpose:** Centralized data storage, accessible by both Fly.io and Vercel

**Tables:**

#### `players`
```sql
id: uuid (primary key)
discord_user_id: text (unique)
discord_username: text
riot_name: text
riot_tag: text
riot_puuid: text
riot_region: text
discord_rank: text (Iron, Bronze, Silver, etc.)
discord_rank_value: integer (1-25)
discord_mmr: integer (starting at rank midpoint)
current_mmr: integer
peak_mmr: integer
verified_at: timestamp
created_at: timestamp
updated_at: timestamp
```

#### `matches`
```sql
id: uuid (primary key)
match_id: text (unique)
match_type: text ('custom' or 'valorant')
match_date: timestamp
map: text
team_a: jsonb (array of player IDs)
team_b: jsonb (array of player IDs)
winner: text ('A' or 'B')
score: jsonb ({teamA: int, teamB: int})
status: text ('pending', 'in-progress', 'completed')
created_at: timestamp
completed_at: timestamp
```

#### `match_player_stats`
```sql
id: uuid (primary key)
match_id: uuid (foreign key -> matches)
player_id: uuid (foreign key -> players)
team: text ('A' or 'B')
kills: integer
deaths: integer
assists: integer
mvp: boolean
damage: integer
score: integer
points_earned: integer
mmr_before: integer
mmr_after: integer
created_at: timestamp
```

#### `rank_history`
```sql
id: uuid (primary key)
player_id: uuid (foreign key -> players)
old_rank: text
new_rank: text
old_mmr: integer
new_mmr: integer
reason: text ('match', 'verification', 'adjustment')
match_id: uuid (nullable, foreign key -> matches)
created_at: timestamp
```

#### `queue`
```sql
id: uuid (primary key)
player_id: uuid (foreign key -> players)
joined_at: timestamp
expires_at: timestamp (optional)
```

#### `rank_thresholds`
```sql
rank: text (primary key)
min_mmr: integer
max_mmr: integer
role_id: text (Discord role ID)
```

---

## Flow Diagrams

### Verification Flow
```
User: /verify name#tag
↓
Fly.io Bot → Vercel /api/verify-account
↓
Vercel → Valorant API (verify + get rank)
↓
Vercel → Supabase (create player record, set initial rank)
↓
Vercel → Fly.io Bot (webhook or direct response)
↓
Fly.io Bot → Discord (assign role, confirm verification)
```

### Match Reporting Flow
```
User: /match report (wins Team A)
↓
Fly.io Bot → Save to Supabase (match status = completed)
↓
Fly.io Bot → Vercel /api/calculate-rank (async)
↓
Vercel → Supabase (calculate all players' MMR changes)
↓
Vercel → Update rank_thresholds check
↓
Vercel → Fly.io Bot (webhook with rank updates)
↓
Fly.io Bot → Discord (update roles, post match summary)
```

### Queue Flow
```
10 players join queue
↓
Fly.io Bot → Vercel /api/process-queue
↓
Vercel → Supabase (fetch all queued players with ranks)
↓
Vercel → Team balancing algorithm (use Discord MMR)
↓
Vercel → Supabase (create match, clear queue)
↓
Vercel → Fly.io Bot (return match details)
↓
Fly.io Bot → Discord (post match announcement)
```

### AI Analytics Flow
```
User: /why am i losing so much
↓
Fly.io Bot → Vercel /api/analyze-performance
↓
Vercel → Supabase (fetch recent matches, stats)
↓
Vercel → Optional: Valorant API (fetch official matches)
↓
Vercel → AI/rule-based analysis
↓
Vercel → Fly.io Bot (return insights)
↓
Fly.io Bot → Discord (send formatted message)
```

---

## Rank System

### Initial Rank Assignment (from Valorant API)
```typescript
Valorant Rank → Discord Rank Mapping:
Iron → Iron (Discord role)
Bronze → Bronze
Silver → Silver
Gold → Gold
Platinum → Platinum
Diamond → Diamond
Ascendant → Ascendant
Immortal → Immortal
Radiant → Radiant

Starting MMR based on rank:
Iron 1: 100 MMR
Iron 2: 200 MMR
Iron 3: 300 MMR
Bronze 1: 400 MMR
...
Radiant: 2500+ MMR
```

### Rank Progression (Server Matches)
```typescript
MMR Ranges per Rank:
Iron: 0-399
Bronze: 400-799
Silver: 800-1199
Gold: 1200-1599
Platinum: 1600-1999
Diamond: 2000-2399
Ascendant: 2400-2799
Immortal: 2800-3199
Radiant: 3200+

Points System:
Win: +25 base
Loss: -10 base
MVP Win: +30 (+5 bonus)
MVP Loss: -5 (+5 bonus)
High K/D (>2.0): +5 multiplier
Low K/D (<0.5): -5 multiplier
```

### Role Update Logic
```typescript
After MMR calculation:
1. Check if MMR crossed rank threshold
2. If yes:
   - Remove old rank role
   - Add new rank role
   - Log to rank_history
   - Send notification (optional)
```

---

## API Integration Points

### Valorant API (for initial placement & optional analytics)
- ✅ Account verification (`/account/{name}/{tag}`)
- ✅ Current rank (`/mmr/{region}/{name}/{tag}`)
- ✅ Match history (`/matches/{region}/{name}/{tag}`) - for `/why` command
- ✅ Match details (`/match/{match_id}`) - for detailed analysis
- ✅ MMR history (`/mmr-history/{name}/{tag}`) - for trends

### Discord API
- Role management (assign/remove rank roles)
- Slash commands
- Embeds for rich messages
- Buttons/modals for interactions

---

## Implementation Phases

### Phase 1: Foundation
1. Set up Supabase database schema
2. Migrate existing in-memory data to Supabase
3. Update Fly.io bot to use Supabase
4. Create `/verify` command with Vercel function

### Phase 2: Rank System
1. Implement rank calculation Vercel function
2. Auto role update system (Fly.io webhook receiver)
3. `/rank` and `/mmr` commands with progression display
4. Rank history tracking

### Phase 3: Enhanced Features
1. Move queue processing to Vercel
2. Implement AI analytics function
3. `/why` command with real insights
4. Leaderboard enhancements

### Phase 4: UI & Polish
1. Custom UI interface (web dashboard)
2. Rank visualization
3. Match history browser
4. Advanced analytics dashboard

---

## Communication Between Services

### Fly.io ↔ Vercel
**Option 1: Webhooks (Recommended)**
- Vercel functions call Fly.io webhook endpoint
- Fly.io bot exposes HTTP endpoint for callbacks

**Option 2: Direct HTTP**
- Fly.io bot calls Vercel functions directly
- Simpler but Fly.io does the HTTP call

**Option 3: Supabase Realtime**
- Use Supabase realtime subscriptions
- Vercel updates Supabase, Fly.io listens for changes

### Fly.io ↔ Supabase
- Direct database queries (Supabase client)
- REST API or PostgREST

### Vercel ↔ Supabase
- Direct database queries
- REST API or PostgREST

---

## Environment Variables

### Fly.io Bot
```env
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
SUPABASE_URL=
SUPABASE_KEY=
VERCEL_API_URL=  # Base URL for Vercel functions
FLY_WEBHOOK_SECRET=  # For verifying Vercel callbacks
```

### Vercel Functions
```env
SUPABASE_URL=
SUPABASE_KEY=
VALORANT_API_BASE=https://api.henrikdev.xyz/valorant/v1
DISCORD_BOT_TOKEN=  # For webhooks back to Fly.io
FLY_WEBHOOK_URL=  # Fly.io endpoint to receive callbacks
OPENAI_API_KEY=  # If using AI for analytics
```

---

## Custom UI Interface

**Possible Implementation:**
- Next.js app on Vercel
- Supabase Auth (Discord OAuth)
- Dashboard showing:
  - Current Discord rank and MMR
  - Rank progression graph
  - Match history
  - Statistics dashboard
  - Leaderboard
  - Personalized insights

**Tech Stack:**
- Next.js 14 (App Router)
- Tailwind CSS
- Recharts (for graphs)
- Supabase client

---

## Challenges & Solutions

### Challenge 1: Role Update Race Conditions
**Problem:** Multiple matches updating ranks simultaneously
**Solution:** Use Supabase transactions, queue rank updates

### Challenge 2: API Rate Limits
**Problem:** Valorant API has rate limits
**Solution:** Implement caching, batch requests, use Supabase for caching

### Challenge 3: Discord Role Limits
**Problem:** Servers have role limits (250)
**Solution:** Use role hierarchy, combine ranks with divisions if needed

### Challenge 4: Real-time Updates
**Problem:** Need instant rank updates after matches
**Solution:** Use Supabase Realtime or webhook system

---

## Benefits of This Architecture

1. **Scalability**: Vercel handles burst traffic (queue processing, analytics)
2. **Always-On**: Fly.io maintains Discord connection
3. **Separation of Concerns**: Heavy computation separated from Discord bot
4. **Data Persistence**: Supabase as single source of truth
5. **Flexibility**: Easy to add new analytics or features
6. **Cost-Effective**: Vercel free tier for serverless, Fly.io for bot

---

## Next Steps

1. **Confirm architecture** - Does this match your vision?
2. **Set up Supabase** - Create database schema
3. **Update Fly.io bot** - Add Supabase client
4. **Create Vercel functions** - Start with rank calculation
5. **Implement `/verify`** - First end-to-end flow
6. **Build rank system** - Auto role updates
7. **Add analytics** - `/why` command

Would you like me to start implementing any specific part?
