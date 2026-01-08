# Custom Rank System Documentation

## Overview

The bot uses a **custom Discord rank system** separate from Valorant ranks. Valorant ranks are only used for initial placement, then all progression is based on server matches.

## Rank Tiers

### GRNDS (Grounds)
- **GRNDS I**: 0-199 MMR
- **GRNDS II**: 200-399 MMR
- **GRNDS III**: 400-599 MMR
- **GRNDS IV**: 600-799 MMR
- **GRNDS V**: 800-999 MMR (Maximum initial placement)

### BREAKPOINT
- **BREAKPOINT I**: 1000-1199 MMR
- **BREAKPOINT II**: 1200-1399 MMR
- **BREAKPOINT III**: 1400-1599 MMR
- **BREAKPOINT IV**: 1600-1799 MMR
- **BREAKPOINT V**: 1800-1999 MMR

### CHALLENGER
- **CHALLENGER I**: 2000-2199 MMR
- **CHALLENGER II**: 2200-2399 MMR
- **CHALLENGER III**: 2400-2599 MMR
- **CHALLENGER IV**: 2600-2799 MMR
- **CHALLENGER V**: 2800+ MMR

### X (Elite)
- **X**: 3000+ MMR
- **Special**: Only top 10 players by MMR can have X rank
- Automatically assigned/removed based on leaderboard position

## Initial Placement

### Valorant Rank → Discord Rank Mapping

**All players start at GRNDS V maximum**, regardless of Valorant rank.

1. **Base MMR Calculation**:
   - Valorant rank determines base MMR range (all capped at GRNDS V: 800-999)
   - ELO determines position within that range

2. **Confidence Boosting**:
   - **Win Rate Boost**: +50 MMR for >60% win rate, +25 for >50%
   - **Peak Rank Boost**: +30 MMR if peak rank is significantly higher than current
   - **Games Played**: Requires 10+ games for confidence boosting

3. **Final Cap**: All initial placements capped at **999 MMR (GRNDS V)**

## Sticky Rank System

The rank system is designed to be **sticky** - rewarding but requiring consistent performance to rank up.

### MMR Gain Multipliers (Harder to rank up at higher ranks)

- **GRNDS** (0-999 MMR): 100% points (full gain)
- **BREAKPOINT** (1000-1999 MMR): 85% points (15% reduction)
- **CHALLENGER** (2000-2799 MMR): 70% points (30% reduction)
- **CHALLENGER V+** (2800+ MMR): 60% points (40% reduction)

### MMR Loss Multipliers (Easier to maintain rank)

- **GRNDS** (0-999 MMR): 100% loss (full penalty)
- **BREAKPOINT** (1000-1999 MMR): 90% loss (10% reduction)
- **CHALLENGER** (2000-2799 MMR): 85% loss (15% reduction)
- **CHALLENGER V+** (2800+ MMR): 80% loss (20% reduction)

This means:
- ✅ Harder to rank up (requires consistent wins)
- ✅ Easier to maintain rank (less demotion anxiety)
- ✅ Rewards consistent performance
- ✅ Respects high ranks (if you're CHALLENGER, you deserve it)

## Match Scoring System

### Base Points
- **Win**: +15 MMR (reduced from +25 for stickiness)
- **Loss**: -8 MMR (reduced from -10 for stickiness)

### Performance Multipliers

**On Win:**
- K/D ≥ 2.0: +30% bonus
- K/D ≥ 1.5: +15% bonus
- K/D ≥ 1.0: Base points
- K/D ≥ 0.7: -10% penalty
- K/D < 0.7: -20% penalty

**On Loss:**
- K/D ≥ 1.5: -10% penalty (good performance despite loss)
- K/D ≥ 1.0: Base loss
- K/D ≥ 0.5: +10% penalty (poor performance)
- K/D < 0.5: +20% penalty (very poor performance)

### Bonuses
- **MVP on Win**: +8 MMR
- **MVP on Loss**: +3 MMR (still rewarded for good performance)
- **Team MVP on Win**: +5 MMR (if implemented)

### Final Calculation

```
rawPoints = (basePoints × performanceMultiplier) + mvpBonus + teamMVPBonus
finalPoints = rawPoints × stickyMultiplier
newMMR = currentMMR + finalPoints
```

## X Rank System

The **X rank** is special:
- Only the **top 10 players by MMR** can have X rank
- Requires minimum **3000 MMR**
- Automatically updated periodically or after significant MMR changes
- Players demoted from X rank go to **CHALLENGER V**

### Update Logic

1. Fetch top 10 players by MMR
2. Check current X rank holders
3. Remove X rank from players no longer in top 10
4. Assign X rank to new top 10 players (if ≥3000 MMR)

## Rank Progression Example

### Scenario: Player at BREAKPOINT III (1500 MMR)

**Match 1: Win with 2.5 K/D, MVP**
- Base: +15
- Performance: +30% = +4.5
- MVP: +8
- Raw: 27.5
- Sticky (85%): 23 MMR
- New MMR: 1523 (still BREAKPOINT III)

**Match 2: Win with 1.2 K/D**
- Base: +15
- Performance: Base
- Raw: 15
- Sticky (85%): 13 MMR
- New MMR: 1536 (still BREAKPOINT III)

**Match 3: Loss with 0.4 K/D**
- Base: -8
- Performance: +20% penalty = -1.6
- Raw: -9.6
- Sticky (90%): -9 MMR
- New MMR: 1527 (still BREAKPOINT III)

**After 10 wins**: ~150 MMR gained → **BREAKPOINT IV** (1600 MMR)

## Implementation Files

- `src/services/CustomRankService.ts` - Core rank calculation logic
- `src/services/RankCalculationService.ts` - Match rank updates
- `supabase/migrations/001_initial_schema.sql` - Database rank thresholds
- `src/commands/verify.ts` - Initial placement logic

## Key Features

1. ✅ **Sticky System**: Harder to rank up, easier to maintain
2. ✅ **Weighted Scoring**: Performance, MVP, team MVP all factor in
3. ✅ **Initial Cap**: Nobody starts above GRNDS V
4. ✅ **X Rank**: Top 10 only, automatically managed
5. ✅ **Confidence Boosting**: Lifetime stats boost initial placement
6. ✅ **Respect**: High ranks require consistent performance
