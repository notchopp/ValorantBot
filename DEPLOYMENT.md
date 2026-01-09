# Deployment Guide

## Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Environment Variables**
   Create a `.env` file:
   ```env
   DISCORD_BOT_TOKEN=your_bot_token
   DISCORD_CLIENT_ID=your_client_id
   DISCORD_GUILD_ID=your_guild_id
   VALORANT_API_ENABLED=true
   VALORANT_DEFAULT_REGION=na
   ```

3. **Build and Run**
   ```bash
   npm run build
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

## Fly.io Deployment

### Prerequisites
- Fly.io account
- Fly CLI installed

### Steps

1. **Login to Fly.io**
   ```bash
   fly auth login
   ```

2. **Initialize Fly.io App** (if not already done)
   ```bash
   fly launch
   ```
   This will create a `fly.toml` file (already included in the repo).

3. **Set Secrets**
   ```bash
   fly secrets set DISCORD_BOT_TOKEN=your_bot_token
   fly secrets set DISCORD_CLIENT_ID=your_client_id
   fly secrets set DISCORD_GUILD_ID=your_guild_id
   fly secrets set VALORANT_API_ENABLED=true
   fly secrets set VALORANT_DEFAULT_REGION=na
   fly secrets set SUPABASE_URL=https://your-project.supabase.co
   fly secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

4. **Deploy**
   ```bash
   fly deploy
   ```

5. **Check Status**
   ```bash
   fly status
   fly logs
   ```

### Configuration

The `fly.toml` file is configured for:
- Always-on instance (no auto-stop)
- HTTP service on port 3000 (for health checks)
- Single region deployment

### Updating the Bot

Simply run:
```bash
fly deploy
```

The bot will automatically rebuild and restart.

## Discord Bot Setup

1. Go to https://discord.com/developers/applications
2. Create a new application
3. Go to "Bot" section
4. Create a bot and copy the token
5. Enable "Message Content Intent" if needed
6. Go to "OAuth2" > "URL Generator"
7. Select "bot" and "applications.commands" scopes
8. Copy the generated URL and invite the bot to your server

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_BOT_TOKEN` | Discord bot token | Yes |
| `DISCORD_CLIENT_ID` | Discord application client ID | Yes |
| `DISCORD_GUILD_ID` | Discord server ID (optional, for guild commands) | No |
| `VALORANT_API_ENABLED` | Enable/disable Valorant API integration | No (default: true) |
| `VALORANT_DEFAULT_REGION` | Default region for API calls | No (default: na) |
| `SUPABASE_URL` | Supabase project URL | Yes (for database features) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) | Yes (for bot operations) |

## Troubleshooting

### Bot Not Responding
- Check if the bot is online in Discord
- Verify the token is correct
- Check Fly.io logs: `fly logs`

### Commands Not Appearing
- Commands may take up to 1 hour to appear globally
- Use `DISCORD_GUILD_ID` for instant guild commands
- Check bot permissions in Discord server

### API Errors
- Verify Riot IDs are correct (case-sensitive)
- Check API rate limits
- Ensure region matches player's region
