import { Client, GatewayIntentBits, Collection, REST, Routes, Interaction, MessageFlags } from 'discord.js';
import { config } from 'dotenv';
import { defaultConfig, Config } from './config/config';
import { PlayerService } from './services/PlayerService';
import { QueueService } from './services/QueueService';
import { MatchService } from './services/MatchService';
import { RankService } from './services/RankService';
import { RiotIDService } from './services/RiotIDService';
import { ValorantAPIService } from './services/ValorantAPIService';
import { DatabaseService } from './services/DatabaseService';
import { RankCalculationService } from './services/RankCalculationService';
import { CustomRankService } from './services/CustomRankService';
import { RoleUpdateService } from './services/RoleUpdateService';
import { VoiceChannelService } from './services/VoiceChannelService';
import { VercelAPIService } from './services/VercelAPIService';
import { SkillGapAnalyzer } from './services/SkillGapAnalyzer';
import { HostTimeoutService } from './services/HostTimeoutService';
import { AutoMatchDetectionService } from './services/AutoMatchDetectionService';
import { DiscordLogger } from './services/DiscordLogger';
import { PersistentQueueService } from './services/PersistentQueueService';
import { initializeLogger } from './utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
config();

// Extend Client to include commands
interface BotClient extends Client {
  commands: Collection<string, any>;
}

// Initialize services
const appConfig: Config = {
  ...defaultConfig,
  bot: {
    token: process.env.DISCORD_BOT_TOKEN || defaultConfig.bot.token,
    clientId: process.env.DISCORD_CLIENT_ID || defaultConfig.bot.clientId,
    guildId: process.env.DISCORD_GUILD_ID || defaultConfig.bot.guildId,
  },
};

if (!appConfig.bot.token) {
  console.error('❌ DISCORD_BOT_TOKEN is required!');
  process.exit(1);
}

if (!appConfig.bot.clientId) {
  console.error('❌ DISCORD_CLIENT_ID is required!');
  process.exit(1);
}

// Initialize database service
const databaseService = new DatabaseService();

// Initialize custom rank service
const customRankService = new CustomRankService(databaseService);

// Initialize Valorant API service
const valorantAPI = appConfig.valorantAPI.enabled
  ? new ValorantAPIService(appConfig.valorantAPI.apiKey)
  : undefined;

// Initialize core services
const playerService = new PlayerService(appConfig, valorantAPI, databaseService);
const queueService = new QueueService(appConfig, databaseService, playerService);
const matchService = new MatchService(appConfig);
const rankService = new RankService(appConfig, playerService, valorantAPI);
const riotIDService = new RiotIDService(playerService, databaseService);
const rankCalculationService = new RankCalculationService(databaseService, customRankService);
const roleUpdateService = new RoleUpdateService(databaseService, appConfig);
const voiceChannelService = new VoiceChannelService();
const skillGapAnalyzer = new SkillGapAnalyzer(databaseService);
// Initialize Vercel API Service
const vercelAPI = new VercelAPIService(process.env.VERCEL_API_URL);


// Log Vercel API status on startup
if (process.env.VERCEL_API_URL) {
  console.log('✅ VERCEL_API_URL is set:', process.env.VERCEL_API_URL);
} else {
  console.warn('⚠️  VERCEL_API_URL is NOT set - Vercel cloud agents will not work!');
  console.warn('Set it with: fly secrets set VERCEL_API_URL=https://your-app.vercel.app');
}

// Services object to pass to commands (persistentQueueService added after initialization)
let services: any = {
  queueService,
  playerService,
  matchService,
  rankService,
  riotIDService,
  valorantAPI,
  databaseService,
  rankCalculationService,
  customRankService,
  roleUpdateService,
  voiceChannelService,
  vercelAPI,
  skillGapAnalyzer,
  config: appConfig,
};

// Background services (initialized after client is ready)
let hostTimeoutService: HostTimeoutService | null = null;
let autoMatchDetectionService: AutoMatchDetectionService | null = null;
let discordLogger: DiscordLogger | null = null;
let persistentQueueService: PersistentQueueService | null = null;

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Needed for message content access
  ],
}) as BotClient;

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => (file.endsWith('.js') || file.endsWith('.ts')) && !file.endsWith('.d.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      console.log(`✅ Loaded command: ${command.data.name}`);
      
      // Note: mmrData alias is handled during command registration, not here
    } else {
    console.warn(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

// Register slash commands
async function registerCommands() {
  const commands: any[] = [];
  const commandNames = new Set<string>(); // Track registered command names to avoid duplicates
  
  // Get all commands, including mmrData if it exists
  for (const [, cmd] of client.commands.entries()) {
    // Only add the main command data if we haven't seen this command name before
    const commandName = cmd.data.name;
    if (!commandNames.has(commandName)) {
      commands.push(cmd.data.toJSON());
      commandNames.add(commandName);
    }
    
    // If command has mmrData, add it as separate command (only if not already added)
    if ('mmrData' in cmd && cmd.mmrData) {
      const mmrCommandName = cmd.mmrData.name;
      if (!commandNames.has(mmrCommandName)) {
        commands.push(cmd.mmrData.toJSON());
        commandNames.add(mmrCommandName);
      }
    }
  }

  const rest = new REST().setToken(appConfig.bot.token);

  try {
    console.log('🔄 Started refreshing application (/) commands.');

    if (appConfig.bot.guildId) {
      // Guild commands (faster, for development)
      await rest.put(
        Routes.applicationGuildCommands(appConfig.bot.clientId, appConfig.bot.guildId),
        { body: commands }
      );
      console.log(`✅ Successfully reloaded ${commands.length} guild commands.`);
    } else {
      // Global commands (slower, for production)
      await rest.put(Routes.applicationCommands(appConfig.bot.clientId), { body: commands });
      console.log(`✅ Successfully reloaded ${commands.length} global commands.`);
    }
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
}

// Handle interactions
client.on('interactionCreate', async (interaction: Interaction) => {
  if (interaction.isChatInputCommand()) {
    let command = client.commands.get(interaction.commandName);

    // Handle /mmr as alias for /rank
    if (!command && interaction.commandName === 'mmr') {
      command = client.commands.get('rank');
    }

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction, services);
    } catch (error: any) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      
      // Handle interaction timeout errors gracefully
      if (error?.code === 10062) {
        console.warn(`Interaction ${interaction.commandName} timed out - user may have clicked command multiple times`);
        return; // Silently ignore timeout errors
      }

      // Handle already acknowledged errors gracefully
      if (error?.code === 40060) {
        // Interaction was already acknowledged - command likely handled it
        return; // Silently ignore
      }

      // Only try to send error reply if interaction hasn't been handled yet
      // Commands may have already handled the error themselves (via safeEditReply)
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: 'There was an error while executing this command!',
            flags: MessageFlags.Ephemeral,
          });
        } catch (replyError: any) {
          // If we can't reply (e.g., interaction expired or already acknowledged), just log it
          if (replyError?.code !== 10062 && replyError?.code !== 40060) {
            const replyErrorMsg = 'Failed to send error reply';
            console.error(replyErrorMsg, replyError);
            if (discordLogger) {
              discordLogger.error(replyErrorMsg, { error: replyError });
            }
          }
        }
      } else if (interaction.deferred && !interaction.replied) {
        // If deferred but not replied, we can still edit
        try {
          await interaction.editReply({
            content: 'There was an error while executing this command!',
          });
        } catch (replyError: any) {
          // If we can't edit (e.g., already acknowledged), just log it
          if (replyError?.code !== 10062 && replyError?.code !== 40060) {
            const replyErrorMsg = 'Failed to send error reply';
            console.error(replyErrorMsg, replyError);
            if (discordLogger) {
              discordLogger.error(replyErrorMsg, { error: replyError });
            }
          }
        }
      }
      // If already replied, don't try to reply again (would cause 40060 error)
    }
  } else if (interaction.isModalSubmit()) {
    // Handle match report modal
    if (interaction.customId === 'match_report_modal') {
      const matchCommand = client.commands.get('match');
      if (matchCommand && 'handleMatchReportModal' in matchCommand) {
        try {
          await matchCommand.handleMatchReportModal(interaction, services);
        } catch (error) {
          const errorMsg = 'Error handling match report modal';
          console.error(errorMsg, error);
          if (discordLogger) {
            discordLogger.error(errorMsg, { error });
          }
          await interaction.reply({
            content: 'There was an error processing the match report.',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
    // Handle host confirm modal
    else if (interaction.customId === 'host_confirm_modal') {
      const hostCommand = client.commands.get('host');
      if (hostCommand && 'handleHostConfirmModal' in hostCommand) {
        try {
          await hostCommand.handleHostConfirmModal(interaction, services);
        } catch (error) {
          const errorMsg = 'Error handling host confirm modal';
          console.error(errorMsg, error);
          if (discordLogger) {
            discordLogger.error(errorMsg, { error });
          }
          await interaction.reply({
            content: 'There was an error processing the host confirmation.',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  } else if (interaction.isButton()) {
    // Handle button interactions
    const queueCommand = client.commands.get('queue');
    if (queueCommand && 'handleButtonInteraction' in queueCommand) {
      try {
        await queueCommand.handleButtonInteraction(interaction, services);
      } catch (error) {
        const errorMsg = 'Error handling button interaction';
        console.error(errorMsg, error);
        if (discordLogger) {
          discordLogger.error(errorMsg, { error, customId: interaction.customId });
        }
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'There was an error processing your request.',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    }
  }
});

// Bot ready
client.once('ready', async () => {
  console.log(`✅ Bot logged in as ${client.user?.tag}`);
  console.log(`📊 Valorant API: ${valorantAPI ? 'Enabled' : 'Disabled'}`);
  
  // Initialize Discord logger
  const logChannelId = process.env.DISCORD_LOG_CHANNEL_ID || null;
  if (logChannelId) {
    discordLogger = new DiscordLogger(client, logChannelId);
    initializeLogger(discordLogger);
    await discordLogger.log('info', 'Bot started and Discord logger initialized', {
      botTag: client.user?.tag,
      valorantAPI: valorantAPI ? 'Enabled' : 'Disabled',
    });
  } else {
    console.warn('⚠️  DISCORD_LOG_CHANNEL_ID not set - Discord logging disabled');
    console.warn('Set it with: fly secrets set DISCORD_LOG_CHANNEL_ID=your-channel-id');
  }

  // Handle new member joins - send welcome DM
  client.on('guildMemberAdd', async (member) => {
    try {
      // Only send DM if member is not a bot
      if (member.user.bot) {
        return;
      }

      // Send welcome DM - GRNDS themed, natural language
      const welcomeMessage = `Hey ${member.user.username}! 👋\n\nYou're in #GRNDS now. Welcome!\n\nHead over to the welcome page to get started: https://grnds.xyz/welcome\n\nWe're always looking for feedback, so feel free to share your thoughts anytime. Have fun and rank up! 🎮`;

      try {
        await member.send(welcomeMessage);
        console.log('Sent welcome DM to new member', { userId: member.user.id, username: member.user.username });
      } catch (error) {
        // User might have DMs disabled - that's okay, just log it
        console.warn('Could not send welcome DM to new member', {
          userId: member.user.id,
          username: member.user.username,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      console.error('Error handling new member join', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
  
  // Load queue state from database on startup
  try {
    await queueService.loadQueueFromDatabase();
    const queueSize = queueService.getCurrentQueueSizeSync();
    if (queueSize > 0) {
      console.log(`📋 Loaded ${queueSize} player(s) from queue`);
    }
  } catch (error) {
    console.error('Error loading queue on startup', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue even if queue load fails
  }
  
  // Initialize and start background services
  try {
    hostTimeoutService = new HostTimeoutService(
      databaseService,
      matchService,
      playerService,
      client
    );
    hostTimeoutService.start();
    console.log('✅ Host timeout service started');
  } catch (error) {
    console.error('Failed to start host timeout service', { error });
  }

  try {
    autoMatchDetectionService = new AutoMatchDetectionService(
      databaseService,
      matchService,
      valorantAPI,
      vercelAPI,
      playerService,
      client
    );
      autoMatchDetectionService.start();
      console.log('✅ Auto-match detection service started');
  } catch (error) {
    console.error('Failed to start auto-match detection service', { error });
  }

  // Initialize persistent queue service
  try {
    persistentQueueService = new PersistentQueueService(client, queueService, appConfig);
    await persistentQueueService.initializePersistentQueue('lobby');
    // Add to services object after initialization
    services.persistentQueueService = persistentQueueService;
    console.log('✅ Persistent queue service initialized');
  } catch (error) {
    console.error('Failed to initialize persistent queue service', { error });
  }
  
  registerCommands();
});

// Error handling
client.on('error', (error) => {
  const errorMsg = 'Discord client error';
  console.error(errorMsg, error);
  if (discordLogger) {
    discordLogger.error(errorMsg, { error: error instanceof Error ? error.message : String(error) });
  }
});

process.on('unhandledRejection', (error) => {
  const errorMsg = 'Unhandled promise rejection';
  console.error(errorMsg, error);
  if (discordLogger) {
    discordLogger.error(errorMsg, { error: error instanceof Error ? error.message : String(error) });
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  // Stop background services
  if (hostTimeoutService) hostTimeoutService.stop();
  if (autoMatchDetectionService) autoMatchDetectionService.stop();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  // Stop background services
  if (hostTimeoutService) hostTimeoutService.stop();
  if (autoMatchDetectionService) autoMatchDetectionService.stop();
  client.destroy();
  process.exit(0);
});

// Start HTTP server for Fly.io health checks
// Fly.io requires apps to listen on a port bound to 0.0.0.0
import * as http from 'http';

const PORT = parseInt(process.env.PORT || '8080', 10);

const server = http.createServer((req: any, res: any) => {
  // Simple health check endpoint
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      bot: client.user ? 'online' : 'connecting',
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Health check server listening on 0.0.0.0:${PORT}`);
});

// Login
client.login(appConfig.bot.token);
