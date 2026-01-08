# Match Reporting System Guide

## Overview

The match reporting system now collects detailed player statistics (kills, deaths, assists, MVP) during match reporting. This enables accurate MMR calculation based on individual performance.

## How to Report a Match

### Step 1: Use `/match report` Command

When an active match is completed, use the `/match report` command. This will open a modal with the following fields:

### Step 2: Fill in the Modal

#### Required Fields:
- **Winner**: Enter either "A" or "B" to indicate which team won
- **Score** (optional): Enter the final score in format `13-10` (Team A score - Team B score)

#### Optional Stat Fields:
- **Team A Stats**: Enter player stats for Team A
- **Team B Stats**: Enter player stats for Team B

### Step 3: Enter Player Stats

Player stats are entered using a simple text format. Each player's stats go on a new line.

#### Format:
```
username:K/D/A
username:K/D/A
...
MVP:username
```

Where:
- `username` is the player's Discord username (must match exactly)
- `K` is kills (number)
- `D` is deaths (number)
- `A` is assists (number)
- The `MVP:username` line designates the MVP for that team

#### Example for Team A Stats:
```
Player1:15/10/5
Player2:12/8/7
Player3:20/5/10
Player4:8/12/3
Player5:11/9/8
MVP:Player3
```

#### Example for Team B Stats:
```
Enemy1:18/11/4
Enemy2:10/12/6
Enemy3:14/10/8
Enemy4:9/13/5
Enemy5:13/9/7
MVP:Enemy1
```

### Important Notes:

1. **Usernames are case-insensitive** - "Player1", "player1", and "PLAYER1" all match
2. **Spaces are flexible** - You can use `15/10/5` or `15 / 10 / 5`
3. **Stats are optional** - If you don't provide stats, they default to 0/0/0
4. **Only one MVP per team** - The last MVP line for each team is used
5. **Unknown usernames are ignored** - Only players in the match roster are recorded
6. **Partial stats are OK** - You can report stats for some players and not others

## What Happens After Reporting

### 1. Match Saved to Database
The match details (winner, score, map, teams) are saved to Supabase.

### 2. Player Stats Saved
Individual player stats (K/D/A, MVP, MMR before) are saved for each player.

### 3. MMR Calculation (Vercel API)
The Vercel `calculate-rank` API is called to:
- Calculate points earned based on performance using the sticky rank system
- Apply performance multipliers based on K/D ratio
- Add MVP bonuses
- Update player MMR and ranks in database
- Log rank changes to rank history

### 4. Discord Roles Updated
For any players who ranked up or down, their Discord roles are automatically updated.

### 5. Match Summary Posted
A detailed embed is posted showing:
- Winner and score
- **MVP(s)** - Players designated as MVP
- **Top Performers** - Top 3 players by K/D ratio with their stats
- **MMR Changes** - Points earned/lost for each player
- **Rank Changes** - Players who ranked up or down

## Example Match Summary

```
✅ Match Reported
Match match-abc123 has been completed.

Winner: Team A
Score: 13-10

🏆 MVP
🏆 Player3

⭐ Top Performers
Player3: 20/5/10 (K/D: 4.00)
Enemy1: 18/11/4 (K/D: 1.64)
Player1: 15/10/5 (K/D: 1.50)

📊 MMR Changes
Player1: +17 MMR (850 → 867)
Player2: +15 MMR (720 → 735)
Player3: +23 MMR (900 → 923)
Enemy1: -5 MMR (800 → 795)
Enemy2: -8 MMR (650 → 642)

⬆️ Rank Ups
Player3: GRNDS V → BREAKPOINT I 🎉
```

## MMR Calculation Details

The system uses a **sticky rank system** with performance-based modifiers:

### Base Points
- **Win**: +15 MMR
- **Loss**: -8 MMR

### Performance Multipliers (Wins)
- K/D ≥ 2.0: +30% bonus
- K/D ≥ 1.5: +20% bonus
- K/D ≥ 1.0: +10% bonus
- K/D < 0.7: -10% penalty

### Performance Multipliers (Losses)
- K/D ≥ 1.5: -5% penalty (good performance)
- K/D < 0.5: +10% penalty (poor performance)

### MVP Bonuses
- **MVP on Win**: +8 MMR
- **MVP on Loss**: +3 MMR

### Sticky Multipliers
Higher ranks gain MMR slower and lose it faster:
- **GRNDS** (0-999): 100% gain, 100% loss
- **BREAKPOINT** (1000-1999): 90% gain, 110% loss
- **CHALLENGER** (2000-2799): 80% gain, 115% loss
- **CHALLENGER V+** (2800+): 70% gain, 120% loss

## Edge Cases

### What if I don't have stats?
No problem! Just leave the Team A Stats and Team B Stats fields empty. The system will use default values (0/0/0, no MVP) and calculate MMR based on win/loss only.

### What if I make a mistake in the stats?
Unfortunately, you cannot edit a match report once submitted. Contact an admin to manually adjust the data if needed.

### What if a player disconnected?
You can enter their stats as 0/0/0, or just omit them from the stats input. The system handles missing stats gracefully.

### What if the Vercel API fails?
The match is still saved to the database. The system logs errors and continues. An admin can manually trigger rank recalculation if needed.

## Technical Details

For developers working on this system:

### Files Modified
- `src/commands/match.ts` - Enhanced modal and parsing logic
- Modal now includes 4 input fields (winner, score, team A stats, team B stats)
- Added `parseTeamStats()` function to parse K/D/A format
- Updated `handleMatchReportModal()` to use parsed stats

### Database Schema
Player stats are stored in `match_player_stats` table:
```sql
match_id UUID
player_id UUID
team TEXT ('A' or 'B')
kills INTEGER
deaths INTEGER
assists INTEGER
mvp BOOLEAN
mmr_before INTEGER
mmr_after INTEGER (updated by Vercel API)
points_earned INTEGER (updated by Vercel API)
```

### Vercel API Integration
The `calculate-rank` API endpoint:
- Receives: `{ matchId: string }`
- Fetches match and player stats from Supabase
- Calculates points using `calculateMatchPoints()` function
- Updates player MMR, ranks, and peak MMR
- Logs rank changes to `rank_history`
- Returns: Array of player results with rank changes

## Future Enhancements

Potential improvements to the system:
- [ ] Multi-page modal flow for easier stat entry
- [ ] Auto-populate stats from Valorant API (if match IDs available)
- [ ] In-game screenshot OCR for stat extraction
- [ ] Role-based permissions (only match host can report)
- [ ] Edit/undo match reports within 5 minutes
- [ ] Detailed match analytics and history
