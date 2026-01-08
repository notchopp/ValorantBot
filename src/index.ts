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

// Services object to pass to commands
const services = {
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
  config: appConfig,
} as const;

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
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

      const reply = {
        content: 'There was an error while executing this command!',
        flags: MessageFlags.Ephemeral as any,
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (replyError: any) {
        // If we can't reply (e.g., interaction expired), just log it
        if (replyError?.code !== 10062) {
          console.error('Failed to send error reply:', replyError);
        }
      }
    }
  } else if (interaction.isModalSubmit()) {
    // Handle match report modal
    if (interaction.customId === 'match_report_modal') {
      const matchCommand = client.commands.get('match');
      if (matchCommand && 'handleMatchReportModal' in matchCommand) {
        try {
          await matchCommand.handleMatchReportModal(interaction, services);
        } catch (error) {
          console.error('Error handling match report modal:', error);
          await interaction.reply({
            content: 'There was an error processing the match report.',
            ephemeral: true,
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
        console.error('Error handling button interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'There was an error processing your request.',
            ephemeral: true,
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
  
  registerCommands();
});

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});

// Login
client.login(appConfig.bot.token);
