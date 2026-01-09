# Welcome to GRNDS - Your Custom Ranked System

Yo! Welcome to **#GRNDS**. This is a passion project I built to make ranked fun again. Everything you see here is custom made for you, from the ground up. No boring Riot ranks here, we run our own show with custom tiers, real time MMR tracking, and commands that actually make you want to queue up and grind.

This system is all about competition, progression, and that dopamine hit when you see your MMR go up. Whether you're trying to hit X rank or just flex your stats on your friends, we got you covered.

## The Rank System

We use a custom rank system with real MMR (Match Making Rating) that goes up and down based on your performance in custom games. Here's how it breaks down:

**Rank Tiers:**
- **GRNDS I-V** (0-999 MMR) - Everyone starts here, grind your way up
- **BREAKPOINT I-V** (1000-1999 MMR) - You're getting good, keep pushing
- **CHALLENGER I-V** (2000-2999 MMR) - Top tier players, respect
- **X Rank** (3000+ MMR) - The elite, only top 10 players, the absolute best

Your rank updates automatically after every game. Win and you go up, lose and you go down. It's that simple.

## Getting Started

Before you can use any commands, you need to verify your account:

1. **Link your Riot account:** `/riot link name:YourName tag:1234 region:na`
2. **Get verified and placed:** `/verify` - This calculates your starting MMR and assigns your Discord rank role

That's it. Once you're verified, all the commands below unlock for you.

## Command Guide

### 📊 Progression Commands

These are your bread and butter for tracking improvement. Use these to see where you're at and where you're going.

**Coming Soon:** AI powered commands like `/agent` (daily AI analysis sessions) and `/predict` (pre-match win probability) are in development and will be released in future updates.

**`/progress`**
Shows your detailed rank progression with a visual MMR bar, your current rank, how much MMR you need for the next rank, and even estimates how many wins you need. This is your main dashboard.

**`/streak`**
Check your current win or loss streak. See the MMR impact, your best win streak, worst loss streak, and your last 5 games. Great for when you're on fire or need motivation to break a losing streak.

**`/history [count]`**
View your recent match history. Set count from 1 to 25 (default is 10). Each match shows your K/D/A, MMR change, map, date, and MVP badges if you popped off. Perfect for reviewing your recent performance.

**`/session`**
See today's grind summary. Shows all your games from today, your W/L record, total MMR change, K/D ratio, MVP count, and highlights your best game. Use this at the end of your session to see if you're improving.

### ⚔️ Social & Competition Commands

These commands are all about comparison and rivalry. Use them to see how you stack up and who's climbing.

**`/compare @user`**
Compare yourself with any other player side by side. Shows rank, MMR, win rate, K/D, MVPs, and peak MMR. Determines an overall winner based on 5 categories. Great for settling debates about who's better.

**`/hot`**
See the top 10 players with the biggest MMR gains in the last 7 days. Shows who's climbing fast, their win rates, and how many games they played. This is your leaderboard for recent performance, updated in real time.

**`/xwatch`**
Track the X rank leaderboard, the top 10 players with 3000+ MMR. Shows 24 hour MMR trends so you can see who's moving up or down. Crown emoji for the #1 player. This is where legends are made.

### 🧠 AI Analysis Commands

Use AI to get insights into your performance and identify areas for improvement.

**`/why`**
Get an AI powered breakdown of why you might be losing or stuck at your current rank. Analyzes your recent match performance, identifies patterns, and provides specific insights based on your stats. Perfect for when you're tilted and need to understand what's going wrong. Limited to 3 uses per day to ensure quality analysis, we plan to increase this limit in the future based on demand.

### 🎮 Account & Stats Commands

Basic commands for managing your account and viewing stats.

**`/rank`** or **`/mmr`**
Quick view of your current rank, MMR, and progress to next rank. Simpler than /progress if you just want the basics.

**`/stats [@user]`**
View detailed stats for yourself or another player. Shows games played, wins, losses, win rate, K/D, MVPs, and points. Good for a quick stat check.

**`/riot link`**
Link your Riot account. Required before verification.

**`/riot unlink`**
Unlink your Riot account and remove your rank role. Use this if you want to start over or link a different account.

**`/riot info`**
View your linked Riot ID and current rank info.

**`/riot refresh`**
Refresh your rank from Valorant API. If you ranked up in Valorant, use this to potentially boost your Discord rank (capped at GRNDS V).

**`/verify`**
Get your initial rank placement. Only works once per account after linking.

**`/leaderboard`**
View the server leaderboard showing top players by MMR.

### 🎯 Queue & Match Commands

Commands for joining games and reporting matches.

**`/queue join`**
Join the queue for a 5v5 custom game. When 10 players join, teams are automatically balanced based on MMR.

**`/queue leave`**
Leave the queue if you changed your mind.

**`/queue status`**
Check who's in queue and how many spots are left.

**`/match report`**
Report match results after a custom game finishes. This updates everyone's MMR and ranks.

**`/match cancel`**
Cancel an ongoing match if needed.

## Usage Guidelines

**Respect the commands.** Don't spam them. We encourage use but be reasonable. These commands hit the database and some do complex calculations, so give them a second to breathe between uses.

**Daily limits apply to certain commands:**
- **`/why`** - Limited to 3 uses per day. This is an AI powered analysis command that requires deep data processing. We plan to increase this limit in the future based on server capacity and demand.

**Command visibility:**
Some commands are visible only to you (like `/progress`, `/streak`, `/history`, `/session`, `/why`) to keep your personal stats private and create a healthier competitive culture. Others like `/compare`, `/hot`, and `/xwatch` are public to encourage social interaction and friendly competition.

**Most commands are instant:**
All the progression and social commands are available anytime you want (within rate limits). Check your streak 100 times a day if that's your thing, we don't judge.

**Queue up and play:**
The more games you play, the more accurate your MMR becomes and the more interesting your stats get. This system thrives on active players grinding games.

## Tips & Tricks

- Use `/progress` before and after your gaming session to track daily improvement
- Check `/hot` to see who you're competing against for MMR gains
- Use `/compare` to study X rank players and learn from the best
- Your peak MMR is tracked forever, so you can always see your best performance
- Win streaks give you momentum, the system rewards consistency
- MVPs in matches get recognized in your stats, so play for the team but also pop off when you can

## Technical Stuff

- MMR changes are calculated based on team balance, individual performance, and win/loss
- Rank roles are assigned automatically after verification and after each match
- All stats are updated in real time from the database
- The bot follows strict guardrails for reliability (error handling, timeouts, logging)

## Need Help?

If commands aren't working or you're seeing errors, contact an admin. The bot logs everything, so we can debug issues quickly.

If you want to contribute ideas for new features or improvements, drop them in the feedback channel. This is a community project and I'm always adding new stuff.

---

**Remember:** This system is about making ranked fun and competitive. Grind hard, climb the ladder, and don't take losses too seriously. Every X rank player started at GRNDS I.

Let's run it up. 🔥
