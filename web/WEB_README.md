# GRNDS Hub - Web Application

The competitive dashboard and community hub for the GRNDS ranking system.

## Overview

GRNDS Hub is a Next.js 14 web application that provides:

- **Personal Dashboard**: Track your rank, MMR progression, and competitive stats
- **Season View**: See the current season leaderboard, countdown, and X Watch panel
- **Global Leaderboard**: Browse all players ranked by MMR
- **Profile Pages**: View detailed player stats, rank history, and comments
- **Community Features**: Activity feeds and comments system with profanity filtering

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with dark-first theme
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (Discord OAuth - to be implemented)
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project with the migrations applied

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` from the example:
   ```bash
   cp .env.local.example .env.local
   ```

3. Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Building for Production

```bash
npm run build
npm start
```

## Features

### Rank System

The app uses a custom 4-tier rank system:

- **GRNDS** (I-V): 0-999 MMR - Orange badge
- **BREAKPOINT** (I-V): 1000-1999 MMR - Black badge with white border
- **CHALLENGER** (I-V): 2000-2999 MMR - Red badge
- **X**: Top 10 players only - White badge

### Comments System

- **200 character limit** per comment
- **Profanity allowed**: Words like "fuck" and "shit" are permitted
- **Hard censorship**: Slurs and hate speech are automatically replaced with `****`
- **Rate limiting**: Prevents spam (to be implemented)
- **Targets**: Comments can be posted on profiles, matches, or seasons

### Database Tables

New tables added in migration `003_add_web_features.sql`:

- `seasons`: Season tracking with start/end dates and status
- `activity_feed`: Automatic tracking of rank-ups, MVPs, and big MMR swings
- `comments`: Gamer-native comments with auto-censoring

### Security

- **Row Level Security (RLS)**: All tables have policies to prevent unauthorized access
- **Read-only rank data**: The web app cannot modify ranks or MMR
- **Server-side validation**: All data fetching happens on the server
- **Content filtering**: Automatic censorship of banned words

## Project Structure

```
web/
├── app/                    # Next.js app directory
│   ├── dashboard/          # Personal dashboard page
│   ├── season/             # Season overview page
│   ├── leaderboard/        # Global leaderboard page
│   ├── profile/[userId]/   # Dynamic profile pages
│   ├── layout.tsx          # Root layout with navigation
│   └── page.tsx            # Landing page
├── components/             # Reusable React components
│   ├── RankBadge.tsx       # Rank display badge
│   ├── MMRProgressBar.tsx  # Animated progress bar
│   ├── StatCard.tsx        # Stat display card
│   ├── ActivityFeed.tsx    # Activity feed list
│   ├── CommentSection.tsx  # Comments UI with form
│   └── SeasonCountdown.tsx # Live countdown timer
├── lib/
│   ├── supabase/          # Supabase client utilities
│   │   ├── client.ts      # Browser client
│   │   └── server.ts      # Server client
│   └── types.ts           # TypeScript types and helpers
└── package.json
```

## Design Philosophy

The UI follows these principles:

- **Dark-first**: Pure black background with subtle gradients
- **Dopamine-driven**: Large numbers, progress bars, and satisfying animations
- **Competitive aesthetic**: Serious, clean, and performance-focused
- **Minimal motion**: Animations enhance without distracting
- **Grain overlay**: Subtle texture for depth

## TODO

- [ ] Implement Discord OAuth authentication
- [ ] Add rate limiting for comments
- [ ] Implement comment creation API route
- [ ] Add real-time updates with Supabase subscriptions
- [ ] Create match detail pages
- [ ] Add season history view
- [ ] Implement friends list
- [ ] Add user settings page

## Contributing

This is part of the ValorantBot project. Follow the main project guidelines for contributions.

## License

MIT
