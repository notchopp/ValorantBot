# Valorant API Analysis

This document outlines all available APIs from the [ValorantAPI repository](https://github.com/raimannma/ValorantAPI) and the underlying [Unofficial Valorant API](https://github.com/Henrik-3/unofficial-valorant-api) that we can use in our Discord bot.

## Base URL
`https://api.henrikdev.xyz/valorant/v1`

## Currently Implemented ✅

### 1. Account Information
**Endpoint:** `GET /account/{name}/{tag}`
- **Purpose:** Get player account details
- **Used for:** Verifying Riot ID exists, getting PUUID, account level
- **Implementation:** ✅ Implemented in `ValorantAPIService.getAccount()`
- **Returns:**
  - `puuid` - Player unique identifier
  - `region` - Player region
  - `account_level` - Account level
  - `name` - Riot username
  - `tag` - Riot tag
  - `card` - Player card assets

### 2. MMR (Current Rank)
**Endpoint:** `GET /mmr/{region}/{name}/{tag}`
- **Purpose:** Get current rank/MMR
- **Used for:** Queue balancing, team creation
- **Implementation:** ✅ Implemented in `ValorantAPIService.getMMR()`
- **Returns:**
  - `currenttier` - Numeric tier value
  - `currenttierpatched` - Human-readable rank (e.g., "Diamond 2")
  - `ranking_in_tier` - Rank position within tier
  - `mmr_change_to_last_game` - MMR change from last game
  - `elo` - Current ELO rating
  - `name`, `tag` - Player identifiers

### 3. MMR History
**Endpoint:** `GET /mmr-history/{name}/{tag}`
- **Purpose:** Get rank progression over time
- **Used for:** Showing rank trends, historical data
- **Implementation:** ✅ Implemented in `ValorantAPIService.getMMRHistory()`
- **Returns:** Array of MMR snapshots with dates

### 4. Match History
**Endpoint:** `GET /matches/{region}/{name}/{tag}?mode={mode}`
- **Purpose:** Get player's recent matches
- **Used for:** Viewing match history, statistics
- **Implementation:** ✅ Implemented in `ValorantAPIService.getMatches()`
- **Parameters:**
  - `mode` (optional): Filter by game mode (competitive, unrated, etc.)
- **Returns:** Array of match data with full player stats

### 5. Match by ID
**Endpoint:** `GET /match/{match_id}`
- **Purpose:** Get detailed match information
- **Used for:** Detailed match analysis, post-match reports
- **Implementation:** ✅ Implemented in `ValorantAPIService.getMatchByID()`
- **Returns:** Complete match data including:
  - Round-by-round data
  - Player statistics (kills, deaths, assists, damage)
  - Team compositions
  - Economy data
  - Ability usage

## Additional APIs Available (Not Yet Implemented) 🆕

### 6. Leaderboard
**Endpoint:** `GET /leaderboard/{affinity}?puuid={puuid}`
- **Purpose:** Get competitive leaderboard for a region
- **Use Cases:**
  - Show top players in region
  - Compare player rankings
  - Display competitive ladder
- **Parameters:**
  - `affinity` - Region (na, eu, ap, kr, latam, br)
  - `puuid` (optional) - Specific player to find on leaderboard
- **Potential Usage:** Add `/leaderboard-valorant` command to show official leaderboard

### 7. Account by PUUID
**Endpoint:** `GET /by-puuid/account/{puuid}`
- **Purpose:** Get account info using PUUID instead of name/tag
- **Use Cases:**
  - Alternative lookup method
  - When you have PUUID but not name/tag
- **Potential Usage:** Store PUUID for faster lookups

### 8. MMR by PUUID
**Endpoint:** `GET /by-puuid/mmr/{affinity}/{puuid}`
- **Purpose:** Get MMR using PUUID
- **Use Cases:** 
  - Faster lookups if we store PUUIDs
  - Batch processing players
- **Potential Usage:** Optimize rank fetching for multiple players

### 9. Match History by PUUID
**Endpoint:** `GET /by-puuid/matches/{affinity}/{puuid}?mode={mode}`
- **Purpose:** Get matches using PUUID
- **Use Cases:** Alternative lookup method
- **Potential Usage:** Performance optimization

### 10. Content (Game Content)
**Endpoint:** `GET /content`
- **Purpose:** Get game content (maps, agents, weapons, etc.)
- **Use Cases:**
  - Dynamic map list
  - Agent information
  - Weapon stats
  - Version information
- **Returns:**
  - `characters` - All agents with abilities
  - `maps` - All maps with coordinates, callouts
  - `chromas` - Weapon skins
  - `weapons` - All weapons with stats
  - `gamepods` - Server information
  - `gear` - In-game items
- **Potential Usage:**
  - Auto-update map list
  - Show agent info in match summaries
  - Display weapon stats

### 11. Version Information
**Endpoint:** `GET /version/{affinity}`
- **Purpose:** Get current game version
- **Use Cases:**
  - Version checking
  - Match metadata validation
- **Returns:** Current Valorant version per region

### 12. Crosshair Codes
**Endpoint:** `GET /crosshair/generate?code={code}`
- **Purpose:** Generate crosshair image from code
- **Use Cases:** 
  - Share crosshairs
  - Display player crosshairs
- **Note:** Less relevant for our bot, but available

### 13. Website Information
**Endpoint:** `GET /website/{country_code}`
- **Purpose:** Get Valorant website content per country
- **Use Cases:** Localization, regional content
- **Note:** Likely not needed for our use case

## Match Data Structure Details

Each match returned contains extensive data we could utilize:

### Player Statistics (per player):
- **Combat Stats:**
  - `kills`, `deaths`, `assists`
  - `score` - Combat score
  - `bodyshots`, `headshots`, `legshots`
  - `damage_made`, `damage_received`
  
- **Agent Information:**
  - `character` - Agent played
  - `ability_casts` - Ability usage (Q, E, C, X)
  
- **Economy:**
  - `economy.spent` - Total credits spent
  - `economy.loadout_value` - Average loadout value
  
- **Behavior:**
  - `behavior.afk_rounds` - Rounds AFK
  - `behavior.friendly_fire` - FF stats
  - `behavior.rounds_in_spawn` - Time in spawn

### Team Data:
- `teams.red/blue.has_won` - Match winner
- `teams.red/blue.rounds_won` - Rounds won
- `teams.red/blue.rounds_lost` - Rounds lost

### Round Data:
- Round-by-round breakdown
- Spike plant/defuse events
- Round outcomes

## Recommended Additions

### High Priority 🔴

1. **Content API Integration**
   - Auto-update map list from API
   - Use for dynamic map selection
   - Display map images/assets

2. **Enhanced Match Reporting**
   - If users provide match ID, auto-fetch stats
   - Pre-fill match report modal with API data
   - Validate reported scores against API

3. **Match History Command**
   - `/history [user]` - Show recent matches
   - Link to player's match history
   - Display trends (rank progression, performance)

### Medium Priority 🟡

4. **Leaderboard Integration**
   - `/leaderboard-valorant [region]` - Show official leaderboard
   - Compare server rankings vs official rankings

5. **PUUID Storage**
   - Store PUUID when linking Riot ID
   - Faster subsequent API calls
   - More reliable lookups

6. **MMR Tracking Over Time**
   - Graph rank progression
   - Show rank changes in stats
   - Track improvement trends

### Low Priority 🟢

7. **Agent Statistics**
   - Track most played agents
   - Agent-specific performance stats
   - Team composition analysis

8. **Round-by-Round Analysis**
   - Detailed match breakdowns
   - Clutch situations
   - Economic analysis

## API Rate Limits

**Important:** The Unofficial Valorant API has rate limits:
- Check response headers for rate limit info
- Implement retry logic with exponential backoff
- Cache responses when possible
- Consider batching requests

## Error Handling

Common error codes:
- `404` - Player/match not found
- `403` - Rate limited
- `429` - Too many requests
- `400` - Invalid parameters

Our current implementation handles 404s, but we should add:
- Rate limit detection and backoff
- Retry logic for transient errors
- Better error messages for users

## Implementation Status Summary

| API Endpoint | Status | Priority | Notes |
|--------------|--------|----------|-------|
| Account | ✅ Implemented | High | Core functionality |
| MMR | ✅ Implemented | High | Core functionality |
| MMR History | ✅ Implemented | Medium | Available but not used in commands |
| Match History | ✅ Implemented | Medium | Available but not exposed |
| Match by ID | ✅ Implemented | Medium | Available but not used |
| Leaderboard | ❌ Not implemented | Medium | Could add feature |
| Content | ❌ Not implemented | High | Should add for maps |
| Version | ❌ Not implemented | Low | Nice to have |
| By PUUID endpoints | ❌ Not implemented | Medium | Performance optimization |

## Next Steps

1. **Add Content API** - Dynamically fetch maps list
2. **Implement Match History Command** - Let users view their recent matches
3. **Add PUUID Storage** - Optimize API calls
4. **Enhanced Match Reporting** - Auto-fill from match ID
5. **Add Rate Limiting** - Proper error handling and retries
