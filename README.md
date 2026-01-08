# Valorant Discord Bot

A production-ready Discord bot for managing semi-competitive Valorant customs with queue management, team balancing, match tracking, and player statistics.

## Features

- **Queue System**: Join/leave queues with automatic match creation when full
- **Rank Integration**: Fetches real Valorant ranks from the Unofficial Valorant API for team balancing
- **Team Balancing**: Auto-balanced teams or captain mode
- **Match Management**: Track matches from creation to completion
- **Player Statistics**: Track wins, losses, K/D, points, and more
- **Leaderboard**: View top players by points
- **Riot ID Linking**: Link your Discord account to your Riot ID for automatic rank fetching

## Setup

### Prerequisites

- Node.js 18+ 
- Discord Bot Token
- Discord Application Client ID

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

4. Build the project:
   ```bash
   npm run build
   ```

5. Start the bot:
   ```bash
   npm start
   ```

For development with auto-reload:
```bash
npm run dev
```

## Commands

### Queue Commands
- `/queue join` - Join the matchmaking queue
- `/queue leave` - Leave the queue
- `/queue status` - Check current queue status

### Riot ID Commands
- `/riot link <name> <tag> [region]` - Link your Riot ID to your Discord account
- `/riot unlink` - Unlink your Riot ID
- `/riot info` - View your linked Riot ID and rank
- `/riot refresh` - Refresh your rank from the API

### Rank Commands
- `/rank set <rank>` - Manually set your rank (fallback if no Riot ID)
- `/rank view` - View your current rank

### Match Commands
- `/match report` - Report match results (opens a modal)
- `/match info` - View current match information

### Stats Commands
- `/stats [user]` - View player statistics
- `/leaderboard [limit]` - View top players leaderboard

## Deployment on Fly.io

1. Install Fly CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

3. Set secrets:
   ```bash
   fly secrets set DISCORD_BOT_TOKEN=your_token_here
   fly secrets set DISCORD_CLIENT_ID=your_client_id_here
   fly secrets set DISCORD_GUILD_ID=your_guild_id_here
   ```

4. Deploy:
   ```bash
   fly deploy
   ```

The bot will automatically stay running on Fly.io with the always-on configuration.

## Configuration

The bot uses the Unofficial Valorant API (https://api.henrikdev.xyz) to fetch player ranks. You can disable this by setting `VALORANT_API_ENABLED=false` in your environment variables.

### Points System

Default points configuration:
- Win: +25 points
- Loss: -10 points
- MVP: +5 points

These can be configured in `src/config/config.ts`.

## Architecture

- **Models**: Data structures (Player, Match, Queue)
- **Services**: Business logic (PlayerService, QueueService, MatchService, etc.)
- **Commands**: Discord slash command handlers
- **Config**: Configuration and environment variables

## Future Enhancements

- Database persistence (currently in-memory)
- Tournament brackets
- Seasonal resets
- Advanced match analytics
- Web dashboard

## License

MIT
