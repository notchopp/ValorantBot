# GRNDS Community Hub - Quick Start

## What Was Built

A complete **Next.js 14 web application** for the GRNDS competitive ranking system, featuring:

- 🏠 **Landing page** with rank system overview
- 📊 **Personal dashboard** with MMR tracking and progress bars
- 🏆 **Season view** with countdown timer and top 10 rankings
- 📋 **Global leaderboard** with all players
- 👤 **Profile pages** with stats and comments
- 💬 **Comments system** with profanity filtering
- 📈 **Activity feed** that auto-tracks rank-ups, MVPs, and big MMR swings

## Quick Setup (5 Minutes)

### 1. Database Setup

In your Supabase SQL Editor, run this migration:

```sql
-- Run: supabase/migrations/003_add_web_features.sql
-- This creates: seasons, activity_feed, comments tables
```

### 2. Environment Setup

```bash
cd web
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Install & Run

```bash
npm install
npm run dev
```

Visit: http://localhost:3000

## File Structure

```
web/
├── app/                      # Pages
│   ├── page.tsx             # Landing page
│   ├── dashboard/           # Personal dashboard
│   ├── season/              # Season overview
│   ├── leaderboard/         # Global rankings
│   └── profile/[userId]/    # Player profiles
├── components/              # UI components
│   ├── RankBadge.tsx
│   ├── MMRProgressBar.tsx
│   ├── StatCard.tsx
│   ├── ActivityFeed.tsx
│   ├── CommentSection.tsx
│   └── SeasonCountdown.tsx
└── lib/                     # Utilities
    ├── supabase/           # Database clients
    └── types.ts            # TypeScript types
```

## Key Features

### Rank System
- **GRNDS** (0-999 MMR) - Orange
- **BREAKPOINT** (1000-1999 MMR) - Black
- **CHALLENGER** (2000-2999 MMR) - Red
- **X** (Top 10) - White

### Automatic Activity Tracking
Database triggers create activity feed entries for:
- Rank ups/downs
- Big MMR gains (30+)
- MVP performances

### Comments System
- 200 character limit
- Profanity allowed (fuck, shit)
- Slurs censored (n-word, f-slur, etc.)
- Row Level Security enabled

## Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Set root directory: `web`
4. Add environment variables
5. Deploy!

## Need Help?

- **Full Setup**: See `WEB_SETUP_GUIDE.md`
- **Technical Details**: See `WEB_IMPLEMENTATION_SUMMARY.md`
- **App Docs**: See `web/WEB_README.md`

## Status

✅ **Build**: Passes with 0 errors
✅ **Lint**: No warnings
✅ **TypeScript**: Fully typed
✅ **Production**: Ready to deploy

---

**Built for the grind. Deploy in 5 minutes. 🚀**
