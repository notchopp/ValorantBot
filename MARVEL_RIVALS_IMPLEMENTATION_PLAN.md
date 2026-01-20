# Marvel Rivals Implementation Plan

## Executive Summary

This document outlines the plan to add Marvel Rivals support to the existing Valorant bot. The goal is to allow users to choose their game (Valorant or Marvel Rivals) and use the same commands for both games, with game-specific data handling.

### 🎯 **Key Decision: Reuse Same Discord Rank System**

**✅ REUSE the same Discord rank system (GRNDS, BREAKPOINT, CHALLENGER, X) with SEPARATE MMR tracking per game.**

**Why:**
- Players can have **different ranks per game** (e.g., CHALLENGER I in Valorant, GRNDS III in Marvel Rivals)
- Same role names = consistency in Discord server
- Separate MMR pools = accurate tracking per game
- Website shows both ranks clearly

### 🎭 **Discord Role Assignment Strategy**

**CRITICAL QUESTION:** If you're X in Valorant but BREAKPOINT in Marvel Rivals, which Discord role do you get?

**✅ SOLUTION: Show HIGHEST rank by default, with option to choose "primary game"**

**Two Options:**

**Option A: Highest Rank (Recommended)**
- Automatically show the **highest rank** of the two games
- Example: X in Valorant + BREAKPOINT in MR = **X role** in Discord
- Simple, always shows your best achievement
- Can switch to "primary game" mode if desired

**Option B: Primary Game**
- User chooses which game is their "primary"
- Discord role shows that game's rank
- Example: Primary = Valorant → Shows X role (even if MR is higher)
- More control, but requires user to manage

**Recommendation: Option A (Highest Rank) with Option B as toggle**

**Implementation:**
- Default: `discord_rank` = highest of `valorant_rank` and `marvel_rivals_rank`
- User can set `primary_game` to override and use that game's rank
- Command: `/game set primary:valorant` or `/game set primary:marvel_rivals`
- Command: `/game set mode:highest` (default) or `/game set mode:primary`

**Example Scenarios:**

**Scenario 1: Highest Rank (Default)**
```
Valorant: X (3500 MMR)
Marvel Rivals: BREAKPOINT II (1100 MMR)
Discord Role: X ✅ (highest rank)
```

**Scenario 2: Primary Game Mode**
```
User: /game set primary:marvel_rivals
Valorant: X (3500 MMR)
Marvel Rivals: BREAKPOINT II (1100 MMR)
Discord Role: BREAKPOINT II (shows primary game's rank)
```

**Scenario 3: Equal Ranks**
```
Valorant: CHALLENGER I (2000 MMR)
Marvel Rivals: CHALLENGER I (2000 MMR)
Discord Role: CHALLENGER I (same either way)
```

**Database Fields:**
- `valorant_rank` / `valorant_rank_value` / `valorant_mmr` - Valorant-specific
- `marvel_rivals_rank` / `marvel_rivals_rank_value` / `marvel_rivals_mmr` - MR-specific
- `discord_rank` / `discord_rank_value` / `current_mmr` - **Computed field** (highest or primary)
- `primary_game` - Which game to use for Discord role (if mode = 'primary')
- `role_mode` - 'highest' or 'primary' (default: 'highest')

**Marvel Rivals Rank Mapping:**
- Bronze I-III → GRNDS I-III (0-400 MMR)
- Silver I-III → GRNDS IV-V (400-800 MMR)
- Gold I-III → BREAKPOINT I-II (800-1200 MMR)
- Platinum I-III → BREAKPOINT III-IV (1200-1600 MMR)
- Diamond I-III → BREAKPOINT V / CHALLENGER I (1600-2200 MMR)
- Grandmaster I-III → CHALLENGER II-III (2200-2600 MMR)
- Celestial I-III → CHALLENGER IV-V (2600-3000 MMR)
- Eternity → CHALLENGER V / X (3000+ MMR)
- One Above All → X (3500+ MMR)

### 🚀 **Vision: "Wake Up and Queue"**

Create a real-time dashboard where players can:
- See live matches happening
- Watch ranks update in real-time
- View queue status for both games
- Track recent activity
- Get excited to queue up in #GRNDS!

---

## Current Architecture Analysis

### What We Have

#### **Core Services**
1. **ValorantAPIService** (`src/services/ValorantAPIService.ts`)
   - Handles all Valorant API calls (HenrikDev API)
   - Methods: `getAccount()`, `getMMR()`, `getMatches()`, `getMatchByID()`, etc.
   - Rate limiting: 30 requests/minute
   - Base URL: `https://api.henrikdev.xyz/valorant`

2. **PlayerService** (`src/services/PlayerService.ts`)
   - Manages player data (cached in-memory + database)
   - Currently stores `riotId` (name, tag, region, puuid)
   - Handles rank fetching from Valorant API

3. **Database Schema** (`supabase/migrations/001_initial_schema.sql`)
   - `players` table has: `riot_name`, `riot_tag`, `riot_puuid`, `riot_region`
   - `matches` table has: `match_type` (currently 'custom' | 'valorant')
   - All rank/MMR fields are game-agnostic

4. **Commands** (15 total)
   - `/riot` - Link/unlink Riot ID (Valorant-specific)
   - `/verify` - Initial rank placement
   - `/rank` or `/mmr` - View Discord rank/MMR
   - `/queue` - Join/leave queue
   - `/match` - Report match results
   - `/leaderboard` - View leaderboard
   - `/stats` - View player stats
   - `/history` - Match history
   - `/compare` - Compare players
   - `/progress` - Rank progression
   - `/streak` - Win/loss streaks
   - `/hot` - Hot players
   - `/host` - Host management
   - `/session` - Session stats
   - `/why` - Rank explanation
   - `/xwatch` - X rank watchlist

5. **Vercel API Endpoints**
   - `/api/verify-account.ts` - Handles verification logic
   - `/api/refresh-rank.ts` - Refreshes rank from Valorant API
   - `/api/calculate-rank.ts` - Calculates rank changes
   - `/api/process-queue.ts` - Queue processing
   - `/api/leaderboard.ts` - Leaderboard data

#### **Key Patterns**
- Commands receive a `services` object with all dependencies
- Database stores game-agnostic MMR/rank data
- API services are injected into services that need them
- Config file (`src/config/config.ts`) has Valorant-specific settings

---

## Marvel Rivals API Analysis

### Available Endpoints (from docs.marvelrivalsapi.com)

#### **Base URLs**
- `https://marvelrivalsapi.com/api/v1`
- `https://marvelrivalsapi.com/api/v2`
- Authentication: `x-api-key` header (you already have this)

#### **Player Endpoints**
1. **Search Player** - `GET /api/v1/find-player/{username}`
   - Returns: Player UID (unique identifier)
   - Use UID for stability (usernames can change)

2. **Player Stats (v1)** - `GET /api/v1/player/{query}`
   - Query can be username or UID (UID recommended)
   - Returns: Level, rank, team info, seasonal performance
   - Includes rank data

3. **Player Stats (v2)** - `GET /api/v2/player/{query}`
   - Enhanced version with more detailed stats

4. **Update Player** - `GET /api/v1/player/{query}/update`
   - Triggers data refresh (rate-limited: once per 30 min per player)
   - Uses queue system

#### **Match History Endpoints**
1. **Match History (v1)** - `GET /api/v1/player/{query}/match-history`
   - Filters: `season`, `skip`, `game_mode`
   - Returns: Basic match data, winner, duration, hero stats

2. **Match History (v2)** - `GET /api/v2/player/{query}/match-history`
   - Pagination: `page`, `limit`
   - Filter: `timestamp`
   - More detailed match data

3. **Search Match** - `GET /api/v1/match/{match_uid}`
   - Get specific match details
   - Includes MVP/SVP status, individual hero stats

#### **Other Endpoints**
- **Heroes** - List/search heroes, hero stats, hero leaderboards
- **Maps** - List/search maps
- **Items** - List/search items
- **Costumes** - List/search hero costumes
- **Battle Pass** - Battle pass data
- **Achievements** - List/search achievements
- **Patch Notes** - Game updates

### Key Differences from Valorant API

| Feature | Valorant API | Marvel Rivals API |
|---------|-------------|-------------------|
| **Player ID** | Riot ID (name#tag) + PUUID | Username or UID (UID preferred) |
| **Region** | Required (na, eu, ap, etc.) | Not required (global?) |
| **Rank System** | Tier-based (Iron-Radiant) | Different system (need to check) |
| **Match Data** | Detailed round-by-round | Hero-focused stats |
| **Rate Limits** | 30/min (with key) | Unknown (check docs) |

---

## Implementation Plan

### Phase 1: Database Schema Updates

#### **1.1 Add Game Selection and Separate MMR Tracking**
```sql
-- Migration: 013_add_game_selection_and_separate_mmr.sql
ALTER TABLE players 
ADD COLUMN preferred_game TEXT DEFAULT 'valorant' 
  CHECK (preferred_game IN ('valorant', 'marvel_rivals'));

-- Marvel Rivals account info
ALTER TABLE players
ADD COLUMN marvel_rivals_uid TEXT,
ADD COLUMN marvel_rivals_username TEXT;

-- SEPARATE MMR/rank tracking per game
-- Valorant (existing fields remain for backward compatibility)
-- These become valorant-specific:
-- discord_rank → valorant_rank (keep for backward compat, add new)
-- discord_rank_value → valorant_rank_value
-- current_mmr → valorant_mmr
-- peak_mmr → valorant_peak_mmr

-- Add Marvel Rivals specific MMR/rank
ALTER TABLE players
ADD COLUMN marvel_rivals_rank TEXT DEFAULT 'Unranked',
ADD COLUMN marvel_rivals_rank_value INTEGER DEFAULT 0,
ADD COLUMN marvel_rivals_mmr INTEGER DEFAULT 0,
ADD COLUMN marvel_rivals_peak_mmr INTEGER DEFAULT 0;

-- Primary Discord rank (highest of the two, or preferred game)
ALTER TABLE players
ADD COLUMN primary_game TEXT DEFAULT 'valorant'
  CHECK (primary_game IN ('valorant', 'marvel_rivals'));

-- Indexes for game-based queries
CREATE INDEX idx_players_preferred_game ON players(preferred_game);
CREATE INDEX idx_players_marvel_rivals_uid ON players(marvel_rivals_uid);
CREATE INDEX idx_players_marvel_rivals_mmr ON players(marvel_rivals_mmr DESC);
CREATE INDEX idx_players_primary_game ON players(primary_game);
```

**Note:** For backward compatibility, keep existing `discord_rank`, `discord_rank_value`, `current_mmr` fields but treat them as Valorant-specific. Gradually migrate to game-specific columns.

#### **1.2 Update Matches Table**
```sql
-- Already has match_type, but update to support Marvel Rivals
ALTER TABLE matches
DROP CONSTRAINT IF EXISTS matches_match_type_check;

ALTER TABLE matches
ADD CONSTRAINT matches_match_type_check 
  CHECK (match_type IN ('custom', 'valorant', 'marvel_rivals'));
```

#### **1.3 Add Game-Specific Stats (if needed)**
- Consider if we need separate stats tables or JSONB columns
- For now, existing stats structure should work (kills, deaths, assists, etc.)

---

### Phase 2: Create Marvel Rivals API Service

#### **2.1 New Service: `MarvelRivalsAPIService.ts`**
**Location:** `src/services/MarvelRivalsAPIService.ts`

**Structure (mirror ValorantAPIService):**
```typescript
export class MarvelRivalsAPIService {
  private api: AxiosInstance;
  private baseURL = 'https://marvelrivalsapi.com/api/v1';
  private apiKey: string;
  private readonly RATE_LIMIT = ?; // Check API docs
  private requestTimestamps: number[] = [];

  // Methods needed:
  - searchPlayer(username: string): Promise<MarvelRivalsPlayer | null>
  - getPlayerStats(query: string): Promise<MarvelRivalsStats | null>
  - getPlayerStatsV2(query: string): Promise<MarvelRivalsStatsV2 | null>
  - getMatchHistory(query: string, filters?: MatchHistoryFilters): Promise<MarvelRivalsMatch[]>
  - getMatchHistoryV2(query: string, page?: number, limit?: number): Promise<MarvelRivalsMatch[]>
  - getMatchByUID(matchUID: string): Promise<MarvelRivalsMatch | null>
  - updatePlayer(query: string): Promise<boolean>
  - parseRankToValue(rankString: string): number
  - getRankValueFromStats(stats: MarvelRivalsStats): number
}
```

**Key Considerations:**
- Rate limiting (check API docs for limits)
- Error handling (404s, rate limits, etc.)
- Response structure mapping
- UID vs username handling

#### **2.2 Type Definitions**
Create interfaces for:
- `MarvelRivalsPlayer` (UID, username, etc.)
- `MarvelRivalsStats` (rank, level, seasonal data)
- `MarvelRivalsMatch` (match details, heroes, stats)
- `MarvelRivalsRank` (rank system structure)

---

### Phase 3: Update Configuration

#### **3.1 Config Updates (`src/config/config.ts`)**
```typescript
export interface Config {
  // ... existing fields
  marvelRivalsAPI: {
    enabled: boolean;
    apiKey?: string;
    defaultRegion?: string; // If needed
  };
  games: {
    supported: ('valorant' | 'marvel_rivals')[];
    default: 'valorant';
  };
  // Game-specific rank configs
  marvelRivalsRanks?: {
    roleNames: string[];
    numericValues: Record<string, number>;
  };
}
```

#### **3.2 Environment Variables**
Add to `.env.example`:
```
MARVEL_RIVALS_API_KEY=your_api_key_here
MARVEL_RIVALS_API_ENABLED=true
```

---

### Phase 4: Update Core Services

#### **4.1 PlayerService Updates**
**Changes needed:**
- Extend Player model to support both games
- Support both `riotId` (Valorant) and `marvelRivalsId` (Marvel Rivals)
- Add separate rank/MMR fields per game
- Update `fetchRankFromAPI()` to handle both games with game parameter

**Updated Player Model:**
```typescript
export interface Player {
  userId: string;
  username: string;
  preferredGame: 'valorant' | 'marvel_rivals';
  primaryGame: 'valorant' | 'marvel_rivals'; // For Discord role
  
  // Valorant data
  valorantRank?: string;
  valorantRankValue?: number;
  valorantMMR?: number;
  valorantPeakMMR?: number;
  riotId?: {
    name: string;
    tag: string;
    region?: string;
    puuid?: string;
  };
  
  // Marvel Rivals data
  marvelRivalsRank?: string;
  marvelRivalsRankValue?: number;
  marvelRivalsMMR?: number;
  marvelRivalsPeakMMR?: number;
  marvelRivalsId?: {
    uid: string;
    username: string;
  };
  
  // Combined stats (or separate per game)
  stats: PlayerStats;
}
```

**New methods:**
```typescript
async linkMarvelRivalsAccount(userId: string, username: string): Promise<boolean>
async fetchMarvelRivalsRank(userId: string): Promise<RankResult>
async fetchRankFromAPI(userId: string, game: 'valorant' | 'marvel_rivals'): Promise<RankResult>
setPreferredGame(userId: string, game: 'valorant' | 'marvel_rivals'): boolean
setPrimaryGame(userId: string, game: 'valorant' | 'marvel_rivals'): boolean
getPlayerRankForGame(userId: string, game: 'valorant' | 'marvel_rivals'): Promise<RankInfo>
getHighestRank(userId: string): Promise<RankInfo> // Returns highest of both games
```

#### **4.2 RankService Updates**
**Changes needed:**
- Accept game parameter in `getPlayerRank()`
- Route to appropriate API service based on game
- Handle rank conversion for both games
- Support getting rank for specific game or primary game

**Updated methods:**
```typescript
async getPlayerRank(
  member: GuildMember, 
  userId: string, 
  game?: 'valorant' | 'marvel_rivals'
): Promise<{ rank: string; rankValue: number; game: string } | null>

async getPlayerRankForGame(
  userId: string, 
  game: 'valorant' | 'marvel_rivals'
): Promise<{ rank: string; rankValue: number; mmr: number } | null>

// Map Marvel Rivals rank to Discord MMR
mapMarvelRivalsRankToMMR(mrRank: string, tier: number): number
mapMarvelRivalsRankToDiscordRank(mrRank: string, tier: number): string
```

#### **4.3 DatabaseService Updates**
**New methods:**
```typescript
async updatePlayerMarvelRivalsID(userId: string, uid: string, username: string): Promise<boolean>
async unlinkPlayerMarvelRivalsID(userId: string): Promise<boolean>
async setPlayerPreferredGame(userId: string, game: string): Promise<boolean>
async getPlayerByMarvelRivalsUID(uid: string): Promise<DatabasePlayer | null>
```

---

### Phase 5: Command Updates

#### **5.1 New Command: `/game`**
**Purpose:** Select preferred game and primary game
```typescript
/game set preferred:<valorant|marvel_rivals>
/game set primary:<valorant|marvel_rivals>  // For Discord role
/game info  // Show current settings and both ranks
```

**Example:**
```
User: /game set primary:marvel_rivals
Bot: Primary game set to Marvel Rivals. Your Discord role will update to your Marvel Rivals rank (GRNDS III).
```

#### **5.2 Update `/riot` Command → `/link`**
**Option A:** Rename to `/link` and support both games
```typescript
/link valorant name:<name> tag:<tag> region:<region>
/link marvel-rivals username:<username>
```

**Option B:** Keep `/riot` for Valorant, add `/marvel` for Marvel Rivals
```typescript
/marvel link username:<username>
/marvel unlink
/marvel info
```

**Recommendation:** Option B (keep existing `/riot`, add `/marvel`)

#### **5.3 Update `/verify` Command**
- Check which game is selected
- Route to appropriate verification logic
- Call game-specific API endpoints

#### **5.4 Update `/rank` Command**
- Show rank for primary game (or preferred game)
- Show both ranks if both games are linked
- Display format:
  ```
  Your Ranks:
  Valorant: CHALLENGER I (2500 MMR)
  Marvel Rivals: GRNDS III (350 MMR)
  
  Primary: Valorant
  Discord Role: CHALLENGER I
  ```

#### **5.5 Update `/queue` Command**
- **Separate queues per game** (recommended)
- `/queue join` - Join queue for your preferred game
- `/queue join game:valorant` - Join specific game queue
- `/queue join game:marvel_rivals` - Join Marvel Rivals queue
- Show queue status per game separately
- Matchmaking only matches players in same game queue

#### **5.6 Update `/match` Command**
- Add game selection in match reporting
- Handle game-specific match data

#### **5.7 Other Commands**
- `/stats` - Show stats for primary game, or both if requested
- `/history` - Filter by game, show both if both linked
- `/leaderboard` - Filter by game or show combined
  - `/leaderboard game:valorant`
  - `/leaderboard game:marvel_rivals`
  - `/leaderboard` (combined view)
- `/compare` - Compare within same game (must specify game)
- `/progress` - Show rank progression for primary game
- `/streak` - Show win/loss streak for primary game

---

### Phase 6: Vercel API Updates

#### **6.1 Update `/api/verify-account.ts`**
- Accept `game` parameter
- Route to game-specific verification logic
- Create Marvel Rivals verification flow

#### **6.2 Update `/api/verify-account.ts` for Multi-Game**
- Add `game` parameter to request
- Route to game-specific verification logic
- For Marvel Rivals:
  - Call Marvel Rivals API
  - Map Marvel Rivals rank to Discord MMR
  - Store in `marvel_rivals_rank`, `marvel_rivals_mmr` fields
  - Update Discord role if primary game is Marvel Rivals

**OR create separate endpoint:**
- `/api/verify-marvel-rivals.ts` - Dedicated Marvel Rivals verification
- Keep `/api/verify-account.ts` for Valorant (backward compatibility)

#### **6.3 Update `/api/refresh-rank.ts`**
- Support both games
- Route based on player's preferred game

---

### Phase 7: Web App Updates

#### **7.1 Profile Page**
- Show game selection
- Display stats for both games (if both linked)
- Game-specific badges/icons

#### **7.2 Leaderboard Page**
- Tabs: "Valorant" | "Marvel Rivals" | "Combined"
- Filter by game
- Show both ranks per player in combined view
- Real-time updates as matches complete

#### **7.3 Real-Time Dashboard (NEW)**
- Live match updates
- Rank change notifications
- Queue status per game
- Recent activity feed
- Make people want to queue! 🎮

#### **7.3 Search**
- Filter by game
- Search by Riot ID or Marvel Rivals username/UID

---

## Rank System Mapping

### ✅ **DECISION: Reuse Same Discord Rank System**

**Key Insight:** Ranks are SEPARATE per game. A player can be:
- **CHALLENGER I** in Valorant
- **GRNDS III** in Marvel Rivals
- At the same time!

**Solution: REUSE the same Discord rank system (GRNDS, BREAKPOINT, CHALLENGER, X) with SEPARATE MMR tracking per game.**

**Marvel Rivals Ranks (from API):**
- Bronze (Tier III-I)
- Silver (Tier III-I)
- Gold (Tier III-I)
- Platinum (Tier III-I)
- Diamond (Tier III-I)
- Grandmaster (Tier III-I)
- Celestial (Tier III-I)
- Eternity
- One Above All

**Mapping Strategy:**
1. **Store separate MMR per game** in database:
   - `valorant_mmr` / `valorant_rank` / `valorant_rank_value`
   - `marvel_rivals_mmr` / `marvel_rivals_rank` / `marvel_rivals_rank_value`
2. **Map both game ranks to same Discord rank system:**
   - Marvel Rivals Bronze → GRNDS I-III (based on tier)
   - Marvel Rivals Silver → GRNDS IV-V
   - Marvel Rivals Gold → BREAKPOINT I-II
   - Marvel Rivals Platinum → BREAKPOINT III-IV
   - Marvel Rivals Diamond → BREAKPOINT V / CHALLENGER I
   - Marvel Rivals Grandmaster → CHALLENGER II-III
   - Marvel Rivals Celestial → CHALLENGER IV-V
   - Marvel Rivals Eternity → CHALLENGER V / X
   - Marvel Rivals One Above All → X
3. **Discord role assignment:** Use the HIGHER of the two ranks (or let user choose primary game)
4. **Website/Leaderboard:** Show both ranks separately

**Benefits:**
- ✅ Consistency: Same rank names across both games
- ✅ Flexibility: Players can have different ranks per game
- ✅ Simplicity: One role system, multiple MMR pools
- ✅ Clarity: Clear separation of game-specific progress

---

## Data Flow Examples

### Example 1: User Links Marvel Rivals Account
```
User: /marvel link username:SpiderMan
Bot: 
  1. Call MarvelRivalsAPIService.searchPlayer("SpiderMan")
  2. Get UID from response
  3. Call getPlayerStats(UID) to verify account exists
  4. Store in database: marvel_rivals_uid, marvel_rivals_username
  5. Set preferred_game = 'marvel_rivals' (if not set)
  6. Confirm success
```

### Example 2: User Verifies with Marvel Rivals
```
User: /verify
Bot:
  1. Check preferred_game (or ask if not set)
  2. If 'marvel_rivals':
     a. Get marvel_rivals_uid from database
     b. Call MarvelRivalsAPIService.getPlayerStats(uid)
     c. Extract rank from stats (e.g., "Diamond II")
     d. Map Marvel Rivals rank to Discord MMR:
        - Diamond II → ~1200 MMR → BREAKPOINT II
     e. Store: marvel_rivals_rank = "BREAKPOINT II"
     f. Store: marvel_rivals_mmr = 1200
     g. Update Discord role if this is higher than Valorant rank
  3. If 'valorant': (existing flow)
```

### Example 3: Queue with Game Selection
```
User: /queue join
Bot:
  1. Check user's preferred_game
  2. Add to queue with game tag
  3. When queue fills, match players with same game preference
  4. Or allow mixed (if desired)
```

### Example 4: User Has Both Games Linked
```
User Profile:
- Valorant: CHALLENGER I (2500 MMR)
- Marvel Rivals: GRNDS III (350 MMR)
- Primary Game: valorant (Discord role shows CHALLENGER I)

User: /rank
Bot shows:
┌─────────────────────────────────┐
│ Your Ranks                      │
├─────────────────────────────────┤
│ Valorant: CHALLENGER I (2500)  │
│ Marvel Rivals: GRNDS III (350)  │
│                                 │
│ Primary: Valorant              │
│ Discord Role: CHALLENGER I      │
└─────────────────────────────────┘

User: /game set primary:marvel_rivals
Bot: Primary game set to Marvel Rivals. Your Discord role will update to GRNDS III.
```

### Example 5: Real-Time Dashboard Vision
```
Website Dashboard (grnds.xyz/dashboard):
┌─────────────────────────────────────────────┐
│ #GRNDS Dashboard                            │
├─────────────────────────────────────────────┤
│ Active Games: 3                             │
│ Queue: 8 players (5 Valorant, 3 MR)        │
│                                             │
│ Recent Matches (Live Updates)              │
│ ┌───────────────────────────────────────┐ │
│ │ Match #1234 - Valorant                │ │
│ │ Team A vs Team B - 13-11              │ │
│ │ 🟢 LIVE - Round 20/24                 │ │
│ │ [View Details]                        │ │
│ └───────────────────────────────────────┘ │
│ ┌───────────────────────────────────────┐ │
│ │ Match #1235 - Marvel Rivals           │ │
│ │ Team A vs Team B - 2-1                │ │
│ │ ✅ COMPLETED - 5 min ago              │ │
│ │ [View Details]                        │ │
│ └───────────────────────────────────────┘ │
│                                             │
│ Rank Updates (Live)                        │
│ ┌───────────────────────────────────────┐ │
│ │ @Player1: GRNDS III → GRNDS IV (+50)  │ │
│ │ @Player2: BREAKPOINT I → BREAKPOINT II│ │
│ │ @Player3: CHALLENGER V → X (+200)     │ │
│ └───────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Database
- [ ] Create migration for game selection
- [ ] Add Marvel Rivals UID/username columns
- [ ] Update matches table constraint
- [ ] Add indexes

### Services
- [ ] Create `MarvelRivalsAPIService.ts`
- [ ] Define TypeScript interfaces
- [ ] Implement rate limiting
- [ ] Add error handling
- [ ] Update `PlayerService` for multi-game
- [ ] Update `RankService` for multi-game
- [ ] Update `DatabaseService` for Marvel Rivals

### Configuration
- [ ] Update `config.ts` with Marvel Rivals settings
- [ ] Add environment variables
- [ ] Update `.env.example`

### Commands
- [ ] Create `/game` command
- [ ] Create `/marvel` command (link/unlink/info)
- [ ] Update `/verify` command
- [ ] Update `/rank` command
- [ ] Update `/queue` command (optional game filtering)
- [ ] Update `/match` command
- [ ] Update `/stats` command
- [ ] Update `/history` command
- [ ] Update `/leaderboard` command
- [ ] Update `/compare` command

### Vercel API
- [ ] Update `/api/verify-account.ts` for multi-game
- [ ] Create `/api/verify-marvel-rivals.ts` (or integrate)
- [ ] Update `/api/refresh-rank.ts` for multi-game

### Web App
- [ ] Update profile page for game selection
- [ ] Update leaderboard for game filtering
- [ ] Update search for game filtering
- [ ] Add game badges/icons

### Testing
- [ ] Test Marvel Rivals API integration
- [ ] Test account linking
- [ ] Test verification flow
- [ ] Test rank fetching
- [ ] Test match history
- [ ] Test queue with game selection
- [ ] Test match reporting

---

## Potential Challenges & Solutions

### Challenge 1: Rank System Mapping ✅ SOLVED
**Problem:** Marvel Rivals has different rank names (Bronze → One Above All)
**Solution:** 
- ✅ **REUSE same Discord rank system** (GRNDS, BREAKPOINT, CHALLENGER, X)
- Map Marvel Rivals ranks to Discord MMR ranges
- Store separate MMR per game
- Example mapping:
  - Bronze I-III → GRNDS I-III (0-400 MMR)
  - Silver I-III → GRNDS IV-V (400-800 MMR)
  - Gold I-III → BREAKPOINT I-II (800-1200 MMR)
  - Platinum I-III → BREAKPOINT III-IV (1200-1600 MMR)
  - Diamond I-III → BREAKPOINT V / CHALLENGER I (1600-2200 MMR)
  - Grandmaster I-III → CHALLENGER II-III (2200-2600 MMR)
  - Celestial I-III → CHALLENGER IV-V (2600-3000 MMR)
  - Eternity → CHALLENGER V / X (3000+ MMR)
  - One Above All → X (top tier, 3500+ MMR)

### Challenge 2: Player Identification
**Problem:** Valorant uses Riot ID (name#tag), Marvel Rivals uses UID
**Solution:**
- Store both identifiers separately
- Use UID for Marvel Rivals (more stable)
- Support username lookup for initial linking

### Challenge 3: Queue Management
**Problem:** Should players queue together or separately?
**Solution:**
- Option A: Separate queues per game
- Option B: Mixed queue (default)
- Option C: User preference
- **Recommendation:** Option C (user preference, default to mixed)

### Challenge 4: Match Reporting
**Problem:** Different match data structures
**Solution:**
- Game-specific match reporting flows
- Store match_type in database
- Handle stats differently per game

### Challenge 5: Rate Limiting
**Problem:** Marvel Rivals API may have different rate limits
**Solution:**
- Check API documentation
- Implement separate rate limiter
- Monitor and adjust

---

## Questions to Resolve ✅

1. **Rank Mapping:** ✅ **SOLVED** - Reuse same Discord rank system, map Marvel Rivals ranks to MMR ranges
2. **Queue Strategy:** Separate queues or mixed? **Recommendation:** Separate queues per game (cleaner matchmaking)
3. **Default Game:** Should users be required to select a game, or default to Valorant? **Recommendation:** Default to Valorant, allow switching
4. **Match Types:** Can we support cross-game matches? **Answer:** No - matches are game-specific
5. **Leaderboard:** Separate leaderboards or combined? **Recommendation:** Both - show separate per game + combined view
6. **Stats Tracking:** Do we track stats separately per game or combined? **Answer:** Separate per game (different stat structures)
7. **Discord Role Assignment:** Use highest rank or primary game? **Recommendation:** Primary game (user chooses), with option to show highest

---

## Next Steps

1. **Research Phase:**
   - Test Marvel Rivals API with your API key
   - Understand rank system structure
   - Check rate limits
   - Test all relevant endpoints

2. **Design Phase:**
   - Finalize rank mapping strategy
   - Decide on queue strategy
   - Design database schema changes
   - Plan command structure

3. **Implementation Phase:**
   - Start with database migrations
   - Build API service
   - Update core services
   - Implement commands
   - Update web app

4. **Testing Phase:**
   - Test all flows
   - Verify data integrity
   - Performance testing
   - User acceptance testing

---

## Estimated Complexity

- **Database Changes:** Low-Medium (2-3 migrations)
- **API Service:** Medium (mirror existing Valorant service)
- **Service Updates:** Medium-High (touches many services)
- **Commands:** Medium (15 commands to update)
- **Vercel API:** Medium (2-3 endpoints)
- **Web App:** Low-Medium (mostly UI updates)

**Total Estimated Time:** 2-3 weeks

**Priority Features for "Wake Up and Queue" Vision:**
1. ✅ Separate MMR per game (enables different ranks)
2. ✅ Real-time match updates on website
3. ✅ Live rank changes visible
4. ✅ Queue status dashboard
5. ✅ Game-specific leaderboards
6. ✅ Recent activity feed

---

## Notes

- Keep existing Valorant functionality intact
- Make changes backward-compatible where possible
- Consider feature flags for gradual rollout
- Document all API endpoints and data structures
- Test thoroughly before production deployment

---

## ✅ Implementation Readiness

**Status: READY TO BEGIN** ✅

See `IMPLEMENTATION_GAPS.md` for:
- Minor gaps to address during implementation
- Recommended implementation order
- Pre-implementation checklist
- Risk mitigation strategies

**Key Points:**
- Plan is comprehensive and actionable
- Minor gaps (rate limits, exact rank format) will be discovered during implementation
- No blockers identified
- Can start with Phase 1 (Database + API Service) immediately
