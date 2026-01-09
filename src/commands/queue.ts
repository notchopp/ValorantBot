import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  Message,
} from 'discord.js';
import { QueueService } from '../services/QueueService';
import { PlayerService } from '../services/PlayerService';
import { RankService } from '../services/RankService';
import { MatchService } from '../services/MatchService';
import { DatabaseService } from '../services/DatabaseService';
import { VoiceChannelService } from '../services/VoiceChannelService';
import { VercelAPIService } from '../services/VercelAPIService';
import { ValorantAPIService } from '../services/ValorantAPIService';
import { SkillGapAnalyzer } from '../services/SkillGapAnalyzer';
import { Config } from '../config/config';

// Constants
const DISCORD_ERROR_UNKNOWN_INTERACTION = 10062;
const DISCORD_ERROR_INTERACTION_EXPIRED = 40060;
const MIN_VALORANT_ACCOUNT_LEVEL = 20;

export const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Queue management commands')
  .addSubcommand((subcommand: any) =>
    subcommand.setName('start').setDescription('Start a new queue session')
  )
  .addSubcommand((subcommand: any) =>
    subcommand.setName('stop').setDescription('Stop the current queue session')
  )
  .addSubcommand((subcommand: any) =>
    subcommand.setName('join').setDescription('Join the queue')
  )
  .addSubcommand((subcommand: any) =>
    subcommand.setName('leave').setDescription('Leave the queue')
  )
  .addSubcommand((subcommand: any) =>
    subcommand.setName('status').setDescription('Check queue status')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    voiceChannelService: VoiceChannelService;
    vercelAPI: VercelAPIService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    persistentQueueService?: any; // PersistentQueueService
    config: Config;
  }
) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'start') {
    await handleStart(interaction, services);
  } else if (subcommand === 'stop') {
    await handleStop(interaction, services);
  } else if (subcommand === 'join') {
    await handleJoin(interaction, services);
  } else if (subcommand === 'leave') {
    await handleLeave(interaction, services);
  } else if (subcommand === 'status') {
    await handleStatus(interaction, services);
  }
}

async function handleStart(
  interaction: ChatInputCommandInteraction,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    voiceChannelService: VoiceChannelService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    config: Config;
  }
) {
  // Don't use ephemeral - make it visible to everyone so they can use the buttons
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    // Validate guild exists
    if (!interaction.guild) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    // Check for queue management roles: #GRNDSMAKER, #GRNDSKEEPER, or chopp
    const member = await interaction.guild.members.fetch(userId);
    const grndsMakerRole = interaction.guild.roles.cache.find(
      (role) => role.name === '#GRNDSMAKER'
    );
    const grndsKeeperRole = interaction.guild.roles.cache.find(
      (role) => role.name === '#GRNDSKEEPER' || role.name === '#GRNDS KEEPER'
    );
    const choppRole = interaction.guild.roles.cache.find(
      (role) => role.name.toLowerCase().includes('chopp') || role.name.toLowerCase() === 'chopp'
    );
    
    const hasPermission = 
      (grndsMakerRole && member.roles.cache.has(grndsMakerRole.id)) ||
      (grndsKeeperRole && member.roles.cache.has(grndsKeeperRole.id)) ||
      (choppRole && member.roles.cache.has(choppRole.id));
    
    if (!hasPermission) {
      await interaction.editReply(
        'Only users with **#GRNDSMAKER**, **#GRNDSKEEPER**, or **chopp** role can start new queues.\n\n' +
        '**Anyone can join the queue!** Use `/queue join` or click the button in the lobby channel.\n' +
        'Need a queue started? Ping <@&' + (grndsMakerRole?.id || '') + '> or any mod!'
      );
      return;
    }

    const { queueService, matchService } = services;

    // Check if queue is already active
    const queue = await queueService.getStatus();
    if (queue.players.length > 0) {
      await interaction.editReply('A queue is already active. Use `/queue stop` to end it first.');
      return;
    }

    // Check if there's an active match
    const currentMatch = matchService.getCurrentMatch();
    if (currentMatch && currentMatch.status === 'in-progress') {
      await interaction.editReply(' There is already a match in progress. Please wait for it to complete.');
      return;
    }

    // Clear any existing queue state
    await queueService.clear();

    const { config, voiceChannelService } = services;

    // Create queue lobby voice channel
    let queueLobbyChannel = null;
    if (interaction.guild) {
      queueLobbyChannel = await voiceChannelService.createQueueLobby(interaction.guild);
      if (queueLobbyChannel) {
        console.log('Queue lobby created', { channelId: queueLobbyChannel.id });
      }
    }

    // Create embed with join button
    const embed = new EmbedBuilder()
      .setTitle('Queue Started!')
      .setDescription('Click the button below to join the queue!')
      .setColor(0x00ff00)
      .addFields({
        name: 'Players Needed',
        value: `0/${config.queue.maxPlayers}`,
        inline: true,
      })
      .addFields({
        name: 'Status',
        value: 'Open',
        inline: true,
      });

    // Add queue lobby info if created
    if (queueLobbyChannel) {
      embed.addFields({
        name: 'Queue Lobby',
        value: `<#${queueLobbyChannel.id}>\n*Join this voice channel while waiting!*`,
        inline: false,
      });
    }

    // Create join queue button
    const joinButton = new ButtonBuilder()
      .setCustomId('queue_join_button')
      .setLabel('Join Queue')
      .setStyle(ButtonStyle.Primary);

    const leaveButton = new ButtonBuilder()
      .setCustomId('queue_leave_button')
      .setLabel('Leave Queue')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(joinButton, leaveButton);

    // Generate queue ID before creating message
    const queueId = `queue-${Date.now()}`;
    
    // Add queue ID to embed footer for identification
    embed.setFooter({ text: `Queue ID: ${queueId}` });

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    // Store queue start message info for later deletion
    if (reply instanceof Message) {
      queueService.setQueueStartMessage(reply.id, reply.channel.id, queueId);
    }
  } catch (error) {
    console.error('Queue start error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });

    await interaction.editReply({
      content: 'An error occurred while starting the queue. Please try again.',
    });
  }
}

async function handleStop(
  interaction: ChatInputCommandInteraction,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    voiceChannelService: VoiceChannelService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    // Validate guild exists
    if (!interaction.guild) {
      await interaction.editReply('This command can only be used in a server.');
      return;
    }

    // Check for queue management roles: #GRNDSMAKER, #GRNDSKEEPER, or chopp
    const member = await interaction.guild.members.fetch(userId);
    const grndsMakerRole = interaction.guild.roles.cache.find(
      (role) => role.name === '#GRNDSMAKER'
    );
    const grndsKeeperRole = interaction.guild.roles.cache.find(
      (role) => role.name === '#GRNDSKEEPER' || role.name === '#GRNDS KEEPER'
    );
    const choppRole = interaction.guild.roles.cache.find(
      (role) => role.name.toLowerCase().includes('chopp') || role.name.toLowerCase() === 'chopp'
    );
    
    const hasPermission = 
      (grndsMakerRole && member.roles.cache.has(grndsMakerRole.id)) ||
      (grndsKeeperRole && member.roles.cache.has(grndsKeeperRole.id)) ||
      (choppRole && member.roles.cache.has(choppRole.id));
    
    if (!hasPermission) {
      await interaction.editReply('Only users with **#GRNDSMAKER**, **#GRNDSKEEPER**, or **chopp** role can stop queues.');
      return;
    }

    const { queueService } = services;

    // Get queue start message info before clearing
    const { messageId, channelId, queueId } = queueService.getQueueStartMessage();

    // Delete queue start message if it exists
    if (messageId && channelId && interaction.guild) {
      try {
        const channel = await interaction.guild.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
          const message = await channel.messages.fetch(messageId);
          await message.delete();
          console.log('Deleted queue start message', { messageId, queueId });
        }
      } catch (error) {
        // Message might already be deleted or not found - that's okay
        console.warn('Could not delete queue start message', {
          messageId,
          channelId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear queue
    await queueService.clear();
    queueService.unlock();

    // Include queue ID in response if multiple queues might exist
    const responseText = queueId 
      ? `Queue stopped and cleared. (Queue ID: ${queueId})`
      : 'Queue stopped and cleared.';
    
    await interaction.editReply(responseText);
  } catch (error) {
    console.error('Queue stop error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });

    await interaction.editReply({
      content: 'An error occurred while stopping the queue. Please try again.',
    });
  }
}

async function handleJoin(
  interaction: ChatInputCommandInteraction,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    voiceChannelService: VoiceChannelService;
    vercelAPI: VercelAPIService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    persistentQueueService?: any; // PersistentQueueService
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { queueService, playerService, rankService, matchService, databaseService, valorantAPI, skillGapAnalyzer, config } = services;

  // Check if there's an active match
  const currentMatch = matchService.getCurrentMatch();
  if (currentMatch && currentMatch.status === 'in-progress') {
    await interaction.editReply('There is already a match in progress. Please wait for it to complete.');
    return;
  }

    // Get player from database
    const dbPlayer = await databaseService.getPlayer(userId);

    // VALIDATION 1: Must have linked Riot ID
    if (!dbPlayer?.riot_name || !dbPlayer?.riot_tag || !dbPlayer?.riot_puuid) {
      await interaction.editReply({
        content:
          ' You must link your Riot ID before joining queue.\n\n' +
          'Use `/riot link` to link your account, then `/verify` to get placed.',
      });
      return;
    }

    // VALIDATION 2: Must be verified (have Discord rank)
    if (!dbPlayer.discord_rank || dbPlayer.discord_rank === 'Unranked') {
      await interaction.editReply({
        content:
          ' You must complete verification before joining queue.\n\n' +
          'Use `/verify` to get your initial Discord rank placement.',
      });
      return;
    }

    // VALIDATION 3: Check Valorant activity (not super strict)
    try {
      if (valorantAPI) {
        const account = await valorantAPI.getAccount(dbPlayer.riot_name, dbPlayer.riot_tag);

        // Check account level (minimum 20)
        if (account && account.account_level < MIN_VALORANT_ACCOUNT_LEVEL) {
          await interaction.editReply({
            content:
              ` Your Valorant account level is below ${MIN_VALORANT_ACCOUNT_LEVEL}.\n\n` +
              `Current level: ${account.account_level}\n` +
              `Play more Valorant to unlock queue access! (Minimum: Level ${MIN_VALORANT_ACCOUNT_LEVEL})`,
          });
          return;
        }

        // Optional: Check recent match activity (past 30 days)
        const matches = await valorantAPI.getMatches(
          dbPlayer.riot_region || config.valorantAPI.defaultRegion,
          dbPlayer.riot_name,
          dbPlayer.riot_tag,
          'competitive'
        );

        if (matches && matches.length === 0) {
          // Warning but allow join
          await interaction.followUp({
            content: ' No recent competitive matches found. Consider playing some Valorant!',
            flags: MessageFlags.Ephemeral,
          });
        }
      }
    } catch (error) {
      console.warn('Could not validate Valorant activity', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't block on API errors - allow join
    }

    // Get or create player
    const player = await playerService.getOrCreatePlayer(userId, username);

  // Try to fetch rank from API or Discord roles
  if (interaction.member && interaction.guild) {
    const member = await interaction.guild.members.fetch(userId);
    const rankData = await rankService.getPlayerRank(member, userId);
    
    if (rankData) {
      player.rank = rankData.rank;
      player.rankValue = rankData.rankValue;
    }
  }

  // Join queue (async)
  const result = await queueService.join(player);

  if (!result.success) {
    await interaction.editReply(result.message);
    return;
  }

  // Get updated queue status
  const queue = await queueService.getStatus();
  const queueSize = queue.players.length;

  // Update persistent queue message if it exists
  const { persistentQueueService } = services;
  if (persistentQueueService) {
    await persistentQueueService.updatePersistentQueueMessage();
  }

  // Check if queue is full (async)
  if (await queueService.isFull()) {
      // Validate guild exists for voice channels
      if (!interaction.guild) {
        await interaction.editReply('Cannot create match: guild not found.');
        return;
      }

      // Lock queue to prevent further joins
      queueService.lock();

      // NEW: Analyze skill gap before creating match
      const playerIds = queue.players.map((p) => p.userId);
      const gapWarning = await skillGapAnalyzer.analyzeQueue(playerIds);

      if (gapWarning.hasWarning && gapWarning.message) {
        // Post warning in channel (visible to everyone)
        if (interaction.channel && 'send' in interaction.channel) {
          await (interaction.channel as any).send({
            content: gapWarning.message,
          });
        }

        // Log for admins
        console.warn('Skill gap detected in queue', {
          gap: gapWarning.details?.gap,
          highest: gapWarning.details?.highestPlayer,
          lowest: gapWarning.details?.lowestPlayer,
        });
      }

      // Call Vercel Cloud Agent to process queue and create match
      const { vercelAPI } = services;
      
      if (!vercelAPI) {
        console.error('vercelAPI is not available in services for queue processing (handleJoin command)');
        queueService.unlock();
        await interaction.editReply('Vercel API service is not available. Please configure VERCEL_API_URL.');
        return;
      }

      console.log('Calling Vercel processQueue API from /queue join command', {
        queueSize: queueSize,
        hasVercelAPI: !!vercelAPI,
        balancingMode: config.teamBalancing.defaultMode,
      });

      const processResult = await vercelAPI.processQueue({
        balancingMode: config.teamBalancing.defaultMode,
      });

      if (!processResult.success || !processResult.match) {
        queueService.unlock();
        await interaction.editReply(
          ` Failed to create match: ${processResult.error || 'Unknown error'}`
        );
        return;
      }

      // Get player objects for match creation (for voice channels and display)
      const teamAPlayers = (await Promise.all(
        processResult.match.teamA.map(async (userId: string) => {
          const player = await playerService.getPlayer(userId);
          if (!player) {
            const dbPlayer = await databaseService.getPlayer(userId);
            if (dbPlayer) {
              return databaseService.databasePlayerToModel(dbPlayer);
            }
          }
          return player;
        })
      )).filter((p): p is NonNullable<typeof p> => p !== undefined);
      const teamBPlayers = (await Promise.all(
        processResult.match.teamB.map(async (userId: string) => {
          const player = await playerService.getPlayer(userId);
          if (!player) {
            const dbPlayer = await databaseService.getPlayer(userId);
            if (dbPlayer) {
              return databaseService.databasePlayerToModel(dbPlayer);
            }
          }
          return player;
        })
      )).filter((p): p is NonNullable<typeof p> => p !== undefined);

      // Create in-memory match object for voice channels
      const match = matchService.createMatch(
        [...teamAPlayers, ...teamBPlayers],
        config.teamBalancing.defaultMode,
        processResult.match.map
      );

      // Override match ID and teams with Vercel result
      match.matchId = processResult.match.matchId;
      match.map = processResult.match.map;
      match.teams.teamA.players = teamAPlayers;
      match.teams.teamB.players = teamBPlayers;
      match.host = teamAPlayers.find((p: any) => p?.userId === processResult.match?.hostUserId) || teamAPlayers[0];

      // Create voice channels and assign team roles
      const { voiceChannelService } = services;
      const { teamAChannel, teamBChannel } = await voiceChannelService.setupTeamVoiceChannels(
        interaction.guild,
        match
      );

      // Store voice channel IDs in match
      if (teamAChannel) match.teams.teamA.voiceChannelId = teamAChannel.id;
      if (teamBChannel) match.teams.teamB.voiceChannelId = teamBChannel.id;

      // Save match to Supabase (already done by Vercel, but ensure voice channels are stored)
      try {
        const teamAUserIds = match.teams.teamA.players.map(p => p.userId);
        const teamBUserIds = match.teams.teamB.players.map(p => p.userId);
        
        const dbMatch = await databaseService.createMatch({
          matchId: match.matchId,
          map: match.map,
          hostUserId: match.host.userId,
        teamA: teamAUserIds,
        teamB: teamBUserIds,
        matchType: 'custom',
      });

      if (!dbMatch) {
        console.error('Failed to save match to database', {
          matchId: match.matchId,
        });
        // Continue anyway - match exists in memory
      }
    } catch (error) {
      console.error('Error saving match to database', {
        matchId: match.matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue anyway - match exists in memory
    }

    queueService.lock();

    // Send match announcement with voice channel info
    const embed = createMatchEmbed(match, config, teamAChannel, teamBChannel);
    if (interaction.channel && 'send' in interaction.channel) {
      await (interaction.channel as any).send({ embeds: [embed] });
    }

    // Clear queue after match creation (async)
    await queueService.clear();
    queueService.unlock();

    await interaction.editReply(' Queue is full! Match created. Check your team voice channels!');
    } else {
      await interaction.editReply(result.message);
    }
  } catch (error) {
    console.error('Queue join error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: ' An error occurred while joining the queue. Please try again.',
    });
  }
}

async function handleLeave(
  interaction: ChatInputCommandInteraction,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    persistentQueueService?: any; // PersistentQueueService
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;

  try {
    const { queueService, persistentQueueService } = services;
    const result = await queueService.leave(userId);
    
    // Update persistent queue message if it exists
    if (persistentQueueService) {
      await persistentQueueService.updatePersistentQueueMessage();
    }
    
    await interaction.editReply(result.message);
  } catch (error) {
    console.error('Queue leave error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: ' An error occurred while leaving the queue. Please try again.',
    });
  }
}

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    config: Config;
  }
) {
  await interaction.deferReply();

  try {
    const { queueService, databaseService, config } = services;
    const queue = await queueService.getStatus();

  const embed = new EmbedBuilder()
    .setTitle('Queue Status')
    .setColor(queue.isLocked ? 0xff0000 : 0x00ff00)
    .addFields({
      name: 'Players',
      value: `${queue.players.length}/${config.queue.maxPlayers}`,
      inline: true,
    })
    .addFields({
      name: 'Status',
      value: queue.isLocked ? ' Locked' : ' Open',
      inline: true,
    });

  if (queue.players.length > 0) {
    // Fetch player data from database to get custom ranks and MMR
    const playersWithRanks = await Promise.all(
      queue.players.map(async (p) => {
        const dbPlayer = await databaseService.getPlayer(p.userId);
        return {
          ...p,
          discordRank: dbPlayer?.discord_rank || 'Unranked',
          currentMMR: dbPlayer?.current_mmr || 0,
        };
      })
    );

    const playerList = playersWithRanks
      .map((p, i) => {
        const rankDisplay =
          p.discordRank !== 'Unranked'
            ? `[${p.discordRank}] (${p.currentMMR} MMR)`
            : '[Unranked]';
        return `${i + 1}. **${p.username}** ${rankDisplay}`;
      })
      .join('\n');
    embed.addFields({ name: 'In Queue', value: playerList || 'None' });
  }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Queue status error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: ' An error occurred while fetching queue status. Please try again.',
    });
  }
}

function createMatchEmbed(
  match: any,
  _config: Config,
  teamAChannel?: any,
  teamBChannel?: any
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(' Match Created!')
    .setColor(match.hostConfirmed ? 0x00ff00 : 0xff9900)
    .addFields({
      name: 'Map',
      value: match.map,
      inline: true,
    })
    .addFields({
      name: 'Host',
      value: `<@${match.host.userId}>`,
      inline: true,
    })
    .addFields({
      name: 'Match ID',
      value: match.matchId,
      inline: true,
    });

  // Add host status
  if (match.hostConfirmed && match.hostInviteCode) {
    embed.addFields({
      name: ' Host Confirmed',
      value: `Invite Code: \`${match.hostInviteCode}\``,
      inline: false,
    });
    embed.setDescription('Host is ready! Join using the invite code above.');
  } else {
      embed.addFields({
        name: '⏳ Waiting for Host',
        value: `<@${match.host.userId}> must create a custom game in Valorant and use \`/host confirm\` to enter the invite code.\n\nUse \`/host info\` to see all players.`,
        inline: false,
      });
      embed.setDescription('Match is pending host confirmation. Host has 10 minutes to create the game and enter the code.');
  }

  const teamAList = match.teams.teamA.players
    .map((p: any) => {
      const rank = p.rank ? ` [${p.rank}]` : '';
      return `• ${p.username}${rank}`;
    })
    .join('\n');

  const teamBList = match.teams.teamB.players
    .map((p: any) => {
      const rank = p.rank ? ` [${p.rank}]` : '';
      return `• ${p.username}${rank}`;
    })
    .join('\n');

  embed
    .addFields({ name: ' Team A', value: teamAList || 'None', inline: true })
    .addFields({ name: ' Team B', value: teamBList || 'None', inline: true });

  // Add voice channel info if available
  if (teamAChannel) {
    embed.addFields({
      name: ' Team A Voice',
      value: `<#${teamAChannel.id}>`,
      inline: true,
    });
  }

  if (teamBChannel) {
    embed.addFields({
      name: ' Team B Voice',
      value: `<#${teamBChannel.id}>`,
      inline: true,
    });
  }

  return embed;
}

/**
 * Handle button interactions for queue
 * Follows guardrails: error handling, validation, logging
 */
export async function handleButtonInteraction(
  interaction: any, // ButtonInteraction from discord.js
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    voiceChannelService: VoiceChannelService;
    vercelAPI: VercelAPIService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    config: Config;
  }
) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const customId = interaction.customId;

  try {
    // Validate guild exists
    if (!interaction.guild) {
      await interaction.reply({
        content: ' This can only be used in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (customId === 'queue_join_button') {
      await handleJoinButton(interaction, services);
    } else if (customId === 'queue_leave_button') {
      await handleLeaveButton(interaction, services);
    } else {
      await interaction.reply({
        content: ' Unknown button interaction.',
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (error) {
    console.error('Button interaction error', {
      userId,
      username,
      customId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Try to send ephemeral error message
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: ' An error occurred. Please try again.',
          flags: MessageFlags.Ephemeral,
        });
      } else if (interaction.deferred) {
        await interaction.followUp({
          content: ' An error occurred. Please try again.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (replyError: any) {
      // Ignore if interaction already expired or acknowledged
      if (
        replyError?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION &&
        replyError?.code !== DISCORD_ERROR_INTERACTION_EXPIRED
      ) {
        console.error('Error sending button error message', { userId, error: replyError });
      }
    }
  }
}

/**
 * Handle join queue button click
 * Follows guardrails: error handling, validation
 */
async function handleJoinButton(
  interaction: any,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    voiceChannelService: VoiceChannelService;
    vercelAPI: VercelAPIService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    persistentQueueService?: any; // PersistentQueueService
    config: Config;
  }
) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Defer update to prevent timeout, but handle errors gracefully
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
  } catch (error: any) {
    if (error?.code === DISCORD_ERROR_UNKNOWN_INTERACTION) {
      console.warn(`Join button interaction timed out for user ${userId} - interaction may have expired`);
      return;
    }
    throw error;
  }

  try {
    const { queueService, playerService, rankService, matchService, databaseService, voiceChannelService, valorantAPI, skillGapAnalyzer, config } = services;

    // Check if there's an active match
    const currentMatch = matchService.getCurrentMatch();
    if (currentMatch && currentMatch.status === 'in-progress') {
      await interaction.editReply(' There is already a match in progress. Please wait for it to complete.');
      return;
    }

    // Get player from database
    const dbPlayer = await databaseService.getPlayer(userId);

    // VALIDATION 1: Must have linked Riot ID
    if (!dbPlayer?.riot_name || !dbPlayer?.riot_tag || !dbPlayer?.riot_puuid) {
      try {
        await interaction.followUp({
          content:
            ' You must link your Riot ID before joining queue.\n\n' +
            'Use `/riot link` to link your account, then `/verify` to get placed.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (error: any) {
        if (error?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION && error?.code !== DISCORD_ERROR_INTERACTION_EXPIRED) {
          console.error('Error sending follow-up message', { userId, error: error.message });
        }
      }
      return;
    }

    // VALIDATION 2: Must be verified (have Discord rank)
    if (!dbPlayer.discord_rank || dbPlayer.discord_rank === 'Unranked') {
      try {
        await interaction.followUp({
          content:
            ' You must complete verification before joining queue.\n\n' +
            'Use `/verify` to get your initial Discord rank placement.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (error: any) {
        if (error?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION && error?.code !== DISCORD_ERROR_INTERACTION_EXPIRED) {
          console.error('Error sending follow-up message', { userId, error: error.message });
        }
      }
      return;
    }

    // VALIDATION 3: Check Valorant activity (not super strict)
    try {
      if (valorantAPI) {
        const account = await valorantAPI.getAccount(dbPlayer.riot_name, dbPlayer.riot_tag);

        // Check account level (minimum 20)
        if (account && account.account_level < MIN_VALORANT_ACCOUNT_LEVEL) {
          try {
            await interaction.followUp({
              content:
                ` Your Valorant account level is below ${MIN_VALORANT_ACCOUNT_LEVEL}.\n\n` +
                `Current level: ${account.account_level}\n` +
                `Play more Valorant to unlock queue access! (Minimum: Level ${MIN_VALORANT_ACCOUNT_LEVEL})`,
              flags: MessageFlags.Ephemeral,
            });
          } catch (error: any) {
            if (
              error?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION &&
              error?.code !== DISCORD_ERROR_INTERACTION_EXPIRED
            ) {
              console.error('Error sending follow-up message', { userId, error: error.message });
            }
          }
          return;
        }

        // Optional: Check recent match activity (past 30 days)
        const matches = await valorantAPI.getMatches(
          dbPlayer.riot_region || config.valorantAPI.defaultRegion,
          dbPlayer.riot_name,
          dbPlayer.riot_tag,
          'competitive'
        );

        if (matches && matches.length === 0) {
          // Warning but allow join
          try {
            await interaction.followUp({
              content: ' No recent competitive matches found. Consider playing some Valorant!',
              flags: MessageFlags.Ephemeral,
            });
          } catch (error: any) {
            if (error?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION && error?.code !== DISCORD_ERROR_INTERACTION_EXPIRED) {
              console.error('Error sending follow-up message', { userId, error: error.message });
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not validate Valorant activity', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't block on API errors - allow join
    }

    // Get or create player
    const player = await playerService.getOrCreatePlayer(userId, username);

    // Try to fetch rank from API or Discord roles
    if (interaction.member && interaction.guild) {
      const member = await interaction.guild.members.fetch(userId);
      const rankData = await rankService.getPlayerRank(member, userId);
      
      if (rankData) {
        player.rank = rankData.rank;
        player.rankValue = rankData.rankValue;
      }
    }

    // Join queue (async)
    const result = await queueService.join(player);

    if (!result.success) {
      // Send ephemeral error message
      try {
        await interaction.followUp({ content: result.message, flags: MessageFlags.Ephemeral });
      } catch (error: any) {
        if (error?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION && error?.code !== DISCORD_ERROR_INTERACTION_EXPIRED) {
          console.error('Error sending follow-up message', { userId, error: error.message });
        }
      }
      return;
    }

    // Try to move user to queue lobby if it exists
    if (interaction.guild) {
      // Find queue lobby channel
      const queueLobbyChannel = interaction.guild.channels.cache.find(
        (ch: any) => ch.type === 2 && ch.name === ' Queue Lobby' // ChannelType.GuildVoice = 2
      ) as any;
      
      if (queueLobbyChannel && interaction.member?.voice.channel) {
        try {
          await voiceChannelService.moveToQueueLobby(
            interaction.guild,
            userId,
            queueLobbyChannel
          );
        } catch (error) {
          // Non-critical - continue even if move fails
          console.error('Error moving user to queue lobby', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    // Get updated queue status
    const queue = await queueService.getStatus();
    const queueSize = queue.players.length;

    // Check if queue is full (async)
    if (await queueService.isFull()) {
      // Validate guild exists for voice channels
      if (!interaction.guild) {
        try {
          await interaction.followUp({
            content: ' Cannot create match: guild not found.',
            flags: MessageFlags.Ephemeral,
          });
        } catch (error) {
          // Ignore follow-up errors
        }
        return;
      }

      // Lock queue to prevent further joins
      queueService.lock();

      // NEW: Analyze skill gap before creating match
      const playerIds = queue.players.map((p) => p.userId);
      const gapWarning = await skillGapAnalyzer.analyzeQueue(playerIds);

      if (gapWarning.hasWarning && gapWarning.message) {
        // Post warning in channel (visible to everyone)
        try {
          await interaction.channel?.send({
            content: gapWarning.message,
          });
        } catch (error) {
          console.error('Error sending skill gap warning', {
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Log for admins
        console.warn('Skill gap detected in queue', {
          gap: gapWarning.details?.gap,
          highest: gapWarning.details?.highestPlayer,
          lowest: gapWarning.details?.lowestPlayer,
        });
      }

      // Call Vercel Cloud Agent to process queue and create match
      const { vercelAPI } = services;
      
      if (!vercelAPI) {
        console.error('vercelAPI is not available in services for queue processing (handleJoinButton)');
        queueService.unlock();
        try {
          await interaction.followUp({
            content: ' Vercel API service is not available. Please configure VERCEL_API_URL.',
            flags: MessageFlags.Ephemeral,
          });
        } catch (error) {
          // Ignore follow-up errors
        }
        return;
      }

      console.log('Calling Vercel processQueue API from queue join button', {
        queueSize,
        hasVercelAPI: !!vercelAPI,
        balancingMode: config.teamBalancing.defaultMode,
      });

      const processResult = await vercelAPI.processQueue({
        balancingMode: config.teamBalancing.defaultMode,
      });

      if (!processResult.success || !processResult.match) {
        queueService.unlock();
        await interaction.editReply(
          ` Failed to create match: ${processResult.error || 'Unknown error'}`
        );
        return;
      }

      // Get player objects for match creation (for voice channels and display)
      const teamAPlayers = (await Promise.all(
        processResult.match.teamA.map(async (userId: string) => {
          const player = await playerService.getPlayer(userId);
          if (!player) {
            const dbPlayer = await databaseService.getPlayer(userId);
            if (dbPlayer) {
              return databaseService.databasePlayerToModel(dbPlayer);
            }
          }
          return player;
        })
      )).filter((p): p is NonNullable<typeof p> => p !== undefined);
      const teamBPlayers = (await Promise.all(
        processResult.match.teamB.map(async (userId: string) => {
          const player = await playerService.getPlayer(userId);
          if (!player) {
            const dbPlayer = await databaseService.getPlayer(userId);
            if (dbPlayer) {
              return databaseService.databasePlayerToModel(dbPlayer);
            }
          }
          return player;
        })
      )).filter((p): p is NonNullable<typeof p> => p !== undefined);

      // Create in-memory match object for voice channels
      const match = matchService.createMatch(
        [...teamAPlayers, ...teamBPlayers],
        config.teamBalancing.defaultMode,
        processResult.match.map
      );

      // Override match ID and teams with Vercel result
      match.matchId = processResult.match.matchId;
      match.map = processResult.match.map;
      match.teams.teamA.players = teamAPlayers;
      match.teams.teamB.players = teamBPlayers;
      match.host = teamAPlayers.find((p: any) => p?.userId === processResult.match?.hostUserId) || teamAPlayers[0];
      
      // Set host fields from database
      const dbMatch = await databaseService.getMatch(match.matchId);
      if (dbMatch) {
        match.hostSelectedAt = dbMatch.host_selected_at ? new Date(dbMatch.host_selected_at) : new Date();
        match.hostConfirmed = dbMatch.host_confirmed || false;
        match.hostInviteCode = dbMatch.host_invite_code || undefined;
      } else {
        match.hostSelectedAt = new Date();
        match.hostConfirmed = false;
      }

      // Create voice channels and assign team roles
      const { teamAChannel, teamBChannel } = await voiceChannelService.setupTeamVoiceChannels(
        interaction.guild,
        match
      );

      // Store voice channel IDs in match
      if (teamAChannel) match.teams.teamA.voiceChannelId = teamAChannel.id;
      if (teamBChannel) match.teams.teamB.voiceChannelId = teamBChannel.id;

      // Send match announcement with voice channel info
      const embed = createMatchEmbed(match, config, teamAChannel, teamBChannel);
      await interaction.channel?.send({ embeds: [embed] });
      
      // Notify host to confirm
      if (interaction.guild && !match.hostConfirmed) {
        try {
          const hostMember = await interaction.guild.members.fetch(match.host.userId);
          await hostMember.send(
            ` You've been selected as the **host** for the match!\n\n` +
            `**Match ID:** ${match.matchId}\n` +
            `**Map:** ${match.map}\n\n` +
            `**Steps to host:**\n` +
            `1. Create a custom game in Valorant\n` +
            `2. Valorant will generate a unique invite code\n` +
            `3. Use \`/host confirm\` and enter the code Valorant gave you\n\n` +
            `You have 10 minutes to confirm, or a new host will be selected.\n\n` +
            `Use \`/host pass\` if you don't want to host.`
          );
        } catch (error) {
          console.warn('Could not send host notification DM', {
            hostId: match.host.userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Clear queue after match creation (async)
      await queueService.clear();
      queueService.unlock();

      // Update the original queue message to show match created
      if (interaction.message && interaction.message.editable) {
        try {
          await interaction.message.edit({
            content: ' Queue is full! Match created. Check your team voice channels!',
            embeds: [],
            components: [],
          });
        } catch (error) {
          console.warn('Failed to update queue message after match creation', { error });
        }
      }
    } else {
      // Fetch player data from database to get custom ranks and MMR for display
      const playersWithRanks = await Promise.all(
        queue.players.map(async (p) => {
          const dbPlayer = await databaseService.getPlayer(p.userId);
          return {
            ...p,
            discordRank: dbPlayer?.discord_rank || 'Unranked',
            currentMMR: dbPlayer?.current_mmr || 0,
          };
        })
      );

      // Update the queue message with new player count
      const updatedEmbed = new EmbedBuilder()
        .setTitle(' Queue Started!')
        .setDescription('Click the button below to join the queue!')
        .setColor(0x00ff00)
        .addFields({
          name: 'Players',
          value: `${queueSize}/${config.queue.maxPlayers}`,
          inline: true,
        })
        .addFields({
          name: 'Status',
          value: queue.isLocked ? ' Locked' : ' Open',
          inline: true,
        });

      if (queueSize > 0) {
        const playerList = playersWithRanks
          .slice(0, 10) // Show first 10
          .map((p, i) => {
            const rankDisplay =
              p.discordRank !== 'Unranked'
                ? `[${p.discordRank}] (${p.currentMMR} MMR)`
                : '[Unranked]';
            return `${i + 1}. **${p.username}** ${rankDisplay}`;
          })
          .join('\n');
        updatedEmbed.addFields({
          name: 'In Queue',
          value: playerList || 'None',
          inline: false,
        });
      }

      const joinButton = new ButtonBuilder()
        .setCustomId('queue_join_button')
        .setLabel('Join Queue')
        .setStyle(ButtonStyle.Primary);

      const leaveButton = new ButtonBuilder()
        .setCustomId('queue_leave_button')
        .setLabel('Leave Queue')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(joinButton, leaveButton);

      // Update the original message (not editReply since we used deferUpdate)
      if (interaction.message && interaction.message.editable) {
        try {
          await interaction.message.edit({
            embeds: [updatedEmbed],
            components: [row],
          });
        } catch (error) {
          console.error('Failed to update queue message', { userId, error });
          // Send ephemeral error
          try {
            await interaction.followUp({
              content: ' Failed to update queue message. Please try again.',
              flags: MessageFlags.Ephemeral,
            });
          } catch (followUpError) {
            // Ignore follow-up errors
          }
        }
      }

      // Send ephemeral confirmation message
      try {
        await interaction.followUp({
          content: ` ${result.message}`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error: any) {
        if (error?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION && error?.code !== DISCORD_ERROR_INTERACTION_EXPIRED) {
          console.error('Error sending join confirmation', { userId, error: error.message });
        }
      }

      // Also update persistent queue message if it exists
      if (services.persistentQueueService) {
        await services.persistentQueueService.updatePersistentQueueMessage();
      }
    }
  } catch (error) {
    console.error('Join queue button error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: ' An error occurred while joining the queue. Please try again.',
    });
  }
}

/**
 * Handle leave queue button click
 * Follows guardrails: error handling, validation
 */
async function handleLeaveButton(
  interaction: any,
  services: {
    queueService: QueueService;
    playerService: PlayerService;
    rankService: RankService;
    matchService: MatchService;
    databaseService: DatabaseService;
    voiceChannelService: VoiceChannelService;
    vercelAPI: VercelAPIService;
    valorantAPI?: ValorantAPIService;
    skillGapAnalyzer: SkillGapAnalyzer;
    config: Config;
  }
) {
  const userId = interaction.user.id;

  // Defer update to prevent timeout, but handle errors gracefully
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
  } catch (error: any) {
    if (error?.code === DISCORD_ERROR_UNKNOWN_INTERACTION) {
      console.warn(`Leave button interaction timed out for user ${userId} - interaction may have expired`);
      return;
    }
    throw error;
  }

  try {
    const { queueService, databaseService } = services;
    const result = await queueService.leave(userId);

    // Update queue message if it exists
    if (interaction.message) {
      const queue = await queueService.getStatus();
      const queueSize = queue.players.length;

      const updatedEmbed = new EmbedBuilder()
        .setTitle(' Queue Started!')
        .setDescription('Click the button below to join the queue!')
        .setColor(0x00ff00)
        .addFields({
          name: 'Players',
          value: `${queueSize}/${services.config.queue.maxPlayers}`,
          inline: true,
        })
        .addFields({
          name: 'Status',
          value: ' Open',
          inline: true,
        });

      if (queueSize > 0) {
        // Fetch player data from database to get custom ranks and MMR for display
        const playersWithRanks = await Promise.all(
          queue.players.map(async (p) => {
            const dbPlayer = await databaseService.getPlayer(p.userId);
            return {
              ...p,
              discordRank: dbPlayer?.discord_rank || 'Unranked',
              currentMMR: dbPlayer?.current_mmr || 0,
            };
          })
        );

        const playerList = playersWithRanks
          .slice(0, 10)
          .map((p, i) => {
            const rankDisplay =
              p.discordRank !== 'Unranked'
                ? `[${p.discordRank}] (${p.currentMMR} MMR)`
                : '[Unranked]';
            return `${i + 1}. **${p.username}** ${rankDisplay}`;
          })
          .join('\n');
        updatedEmbed.addFields({
          name: 'In Queue',
          value: playerList || 'None',
          inline: false,
        });
      }

      const joinButton = new ButtonBuilder()
        .setCustomId('queue_join_button')
        .setLabel('Join Queue')
        .setStyle(ButtonStyle.Primary);

      const leaveButton = new ButtonBuilder()
        .setCustomId('queue_leave_button')
        .setLabel('Leave Queue')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(joinButton, leaveButton);

      try {
        await interaction.message.edit({
          embeds: [updatedEmbed],
          components: [row],
        });
      } catch (error) {
        console.error('Failed to update queue message after leave', { userId, error });
        // Send ephemeral error
        try {
          await interaction.followUp({
            content: ' Failed to update queue message. Please try again.',
            flags: MessageFlags.Ephemeral,
          });
        } catch (followUpError) {
          // Ignore follow-up errors
        }
      }
    }

    // Send ephemeral confirmation message
    if (result.message) {
      try {
        await interaction.followUp({
          content: result.message,
          flags: MessageFlags.Ephemeral,
        });
      } catch (error: any) {
        if (error?.code !== DISCORD_ERROR_UNKNOWN_INTERACTION && error?.code !== DISCORD_ERROR_INTERACTION_EXPIRED) {
          console.error('Error sending leave confirmation', { userId, error: error.message });
        }
      }
    }
  } catch (error) {
    console.error('Leave queue button error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Try to send ephemeral error message
    try {
      if (!interaction.replied) {
        await interaction.followUp({
          content: ' An error occurred while leaving the queue. Please try again.',
          flags: MessageFlags.Ephemeral,
        });
      }
    } catch (followUpError) {
      // Ignore follow-up errors if interaction expired
      if (followUpError instanceof Error && (followUpError as any).code !== DISCORD_ERROR_UNKNOWN_INTERACTION) {
        console.error('Error sending leave error message', { userId, error: followUpError });
      }
    }
  }
}
