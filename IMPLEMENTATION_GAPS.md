# Implementation Gaps & Pre-Implementation Checklist

## ✅ Ready to Implement

The plan is comprehensive and we can begin implementation. However, here are some gaps to address during implementation:

---

## Phase 1 TODO (Foundation)

- [x] Create migration 013 for game selection and separate MMR tracking
- [x] Add Marvel Rivals API service with rate limiting
- [x] Update config and environment variables for Marvel Rivals
- [x] Extend DatabaseService and models for multi-game support
- [x] Update PlayerService and RankService for multi-game handling
- [x] Create `/game` command for preferred/primary game settings
- [x] Create `/marvel` command for link/unlink/info
- [x] Update `/verify` for game selection and Marvel Rivals placement
- [x] Update `/rank` to show both game ranks
- [x] Update `/queue` for game filtering
- [x] Update RoleUpdateService for multi-game role assignment

## 🔍 Gaps to Address During Implementation

### 1. **Marvel Rivals API Rate Limits** ⚠️
**Status:** Unknown - will discover during implementation
**Action:** 
- Start with conservative limit (e.g., 30/min like Valorant)
- Check API response headers for actual limits
- Implement rate limiting similar to ValorantAPIService
- Monitor and adjust

**Implementation Note:**
```typescript
// Start conservative, adjust based on API response
private readonly RATE_LIMIT = 30; // Will verify during testing
```

### 2. **Rank Tier Format** ⚠️
**Status:** Need to verify exact format from API
**Question:** Is it "Bronze I, Bronze II, Bronze III" or "Bronze 1, Bronze 2, Bronze 3"?
**Action:**
- Test API response during implementation
- Create flexible parser that handles both formats
- Update mapping function accordingly

### 3. **Queue Service Game Filtering** 📝
**Status:** Plan mentions it, but needs detailed implementation
**Gap:** QueueService needs to:
- Filter players by game preference
- Separate queues per game (or mixed)
- Matchmaking logic for game-specific queues

**Action:** Update QueueService to support:
```typescript
getQueue(game?: 'valorant' | 'marvel_rivals'): Player[]
joinQueue(userId: string, game: 'valorant' | 'marvel_rivals'): boolean
```

### 4. **Match Service Game-Specific Data** 📝
**Status:** Plan mentions it, but needs structure
**Gap:** MatchService needs to handle:
- Different match data structures per game
- Game-specific stats (heroes vs agents)
- Different scoring systems

**Action:** Create game-specific match handlers

### 5. **Backward Compatibility** ✅
**Status:** Plan addresses this
**Action:** 
- Keep existing `discord_rank`, `current_mmr` fields for Valorant
- Gradually migrate to game-specific fields
- Default existing players to Valorant

### 6. **Initial MMR Calculation** ⚠️
**Status:** Mapping provided, but needs exact values
**Gap:** Need to determine exact MMR ranges for each Marvel Rivals rank tier
**Action:** 
- Start with provided mapping
- Adjust based on actual rank distribution
- May need to balance with Valorant MMR distribution

### 7. **Error Messages** 📝
**Status:** Not detailed in plan
**Gap:** Need game-specific error messages
**Action:** Create error message constants:
```typescript
const ERRORS = {
  VALORANT: {
    ACCOUNT_NOT_FOUND: "Could not find Riot account...",
    // ...
  },
  MARVEL_RIVALS: {
    ACCOUNT_NOT_FOUND: "Could not find Marvel Rivals account...",
    // ...
  }
}
```

### 8. **Database Migration Strategy** ✅
**Status:** Plan has migration, but needs rollback plan
**Action:** 
- Create migration with rollback script
- Test on staging first
- Backup existing data

### 9. **Service Initialization** 📝
**Status:** Plan mentions it, but needs code structure
**Gap:** `src/index.ts` needs to initialize MarvelRivalsAPIService
**Action:** 
```typescript
// Initialize Marvel Rivals API service
const marvelRivalsAPI = appConfig.marvelRivalsAPI.enabled
  ? new MarvelRivalsAPIService(appConfig.marvelRivalsAPI.apiKey)
  : undefined;

// Add to services object
services.marvelRivalsAPI = marvelRivalsAPI;
```

### 10. **Role Update Service** 📝
**Status:** Needs update for multi-game
**Gap:** RoleUpdateService needs to:
- Compare ranks from both games
- Use highest rank or primary game rank
- Handle role updates when primary game changes

**Action:** Update `updatePlayerRole()` to accept game parameter and handle multi-game logic

---

## ✅ Pre-Implementation Checklist

### Research (Can do during implementation)
- [ ] Test Marvel Rivals API with your API key
- [ ] Verify rank format (I/II/III vs 1/2/3)
- [ ] Check actual rate limits from API
- [ ] Test all endpoints we'll use

### Database
- [x] Migration script designed
- [ ] Rollback script created
- [ ] Backup strategy defined

### Code Structure
- [x] Service architecture planned
- [x] Command structure planned
- [ ] Error handling strategy defined
- [ ] Logging strategy defined

### Testing
- [ ] Test plan created
- [ ] Staging environment ready
- [ ] Test accounts prepared

---

## 🚀 Implementation Order (Recommended)

### Phase 1: Foundation (Start Here)
1. **Database Migration**
   - Create migration 013
   - Test on local/staging
   - Backup existing data

2. **MarvelRivalsAPIService**
   - Create service file
   - Implement basic methods (search, getStats)
   - Add rate limiting (start conservative)
   - Test with real API

3. **Config Updates**
   - Add Marvel Rivals config
   - Add environment variables
   - Update .env.example

### Phase 2: Core Services
4. **DatabaseService Updates**
   - Add Marvel Rivals methods
   - Test database operations

5. **PlayerService Updates**
   - Add multi-game support
   - Update models
   - Test player operations

6. **RankService Updates**
   - Add game parameter
   - Implement rank mapping
   - Test rank calculations

### Phase 3: Commands
7. **New Commands**
   - `/game` command
   - `/marvel` command

8. **Update Existing Commands**
   - `/verify` - Add game selection
   - `/rank` - Show both ranks
   - `/queue` - Add game filtering
   - Others as needed

### Phase 4: Vercel API
9. **Update Vercel Endpoints**
   - Update verify-account.ts
   - Create/update refresh-rank.ts
   - Test endpoints

### Phase 5: Polish
10. **Error Handling**
    - Game-specific messages
    - Better user feedback

11. **Testing**
    - End-to-end testing
    - Edge cases
    - Performance testing

12. **Documentation**
    - Update README
    - User guide
    - API documentation

---

## ⚠️ Risks & Mitigations

### Risk 1: API Rate Limits Unknown
**Mitigation:** Start conservative, monitor, adjust

### Risk 2: Rank Mapping May Need Adjustment
**Mitigation:** Start with provided mapping, adjust based on data

### Risk 3: Breaking Existing Functionality
**Mitigation:** 
- Keep backward compatibility
- Test thoroughly
- Gradual rollout

### Risk 4: Database Migration Issues
**Mitigation:**
- Test on staging first
- Backup before migration
- Have rollback ready

---

## ✅ Final Verdict

**READY TO BEGIN IMPLEMENTATION** ✅

The plan is comprehensive. The gaps identified are:
- Minor details that can be resolved during implementation
- Things we'll discover when testing the actual API
- Implementation details that are clear from the plan

**Recommendation:** Start with Phase 1 (Foundation) and iterate. We can adjust as we learn more about the Marvel Rivals API.

---

## Quick Start Commands

When ready to start:

1. **Create migration:**
   ```bash
   # Create new migration file
   touch supabase/migrations/013_add_game_selection_and_separate_mmr.sql
   ```

2. **Create API service:**
   ```bash
   # Create new service file
   touch src/services/MarvelRivalsAPIService.ts
   ```

3. **Test API connection:**
   ```typescript
   // Quick test script
   const api = new MarvelRivalsAPIService(process.env.MARVEL_RIVALS_API_KEY);
   const player = await api.searchPlayer("testusername");
   console.log(player);
   ```

---

## Notes

- All gaps are addressable during implementation
- No blockers identified
- Plan is solid and comprehensive
- Can start immediately with Phase 1
