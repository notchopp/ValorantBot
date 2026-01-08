import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { QueueService } from '../services/QueueService';
import { PlayerService } from '../services/PlayerService';
import { RankService } from '../services/RankService';
import { MatchService } from '../services/MatchService';
import { DatabaseService } from '../services/DatabaseService';
import { VoiceChannelService } from '../services/VoiceChannelService';
import { VercelAPIService } from '../services/VercelAPIService';
import { Config } from '../config/config';

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
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    // Validate guild exists
    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server.');
      return;
    }

    const { queueService, matchService } = services;

    // Check if queue is already active
    const queue = await queueService.getStatus();
    if (queue.players.length > 0) {
      await interaction.editReply('❌ A queue is already active. Use `/queue stop` to end it first.');
      return;
    }

    // Check if there's an active match
    const currentMatch = matchService.getCurrentMatch();
    if (currentMatch && currentMatch.status === 'in-progress') {
      await interaction.editReply('❌ There is already a match in progress. Please wait for it to complete.');
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
      .setTitle('🎮 Queue Started!')
      .setDescription('Click the button below to join the queue!')
      .setColor(0x00ff00)
      .addFields({
        name: 'Players Needed',
        value: `0/${config.queue.maxPlayers}`,
        inline: true,
      })
      .addFields({
        name: 'Status',
        value: '✅ Open',
        inline: true,
      });

    // Add queue lobby info if created
    if (queueLobbyChannel) {
      embed.addFields({
        name: '🎮 Queue Lobby',
        value: `<#${queueLobbyChannel.id}>\n*Join this voice channel while waiting!*`,
        inline: false,
      });
    }

    // Create join queue button
    const joinButton = new ButtonBuilder()
      .setCustomId('queue_join_button')
      .setLabel('Join Queue')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('➕');

    const leaveButton = new ButtonBuilder()
      .setCustomId('queue_leave_button')
      .setLabel('Leave Queue')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('➖');

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(joinButton, leaveButton);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });
  } catch (error) {
    console.error('Queue start error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });

    await interaction.editReply({
      content: '❌ An error occurred while starting the queue. Please try again.',
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
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { queueService } = services;

    // Clear queue
    await queueService.clear();
    queueService.unlock();

    await interaction.editReply('✅ Queue stopped and cleared.');
  } catch (error) {
    console.error('Queue stop error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });

    await interaction.editReply({
      content: '❌ An error occurred while stopping the queue. Please try again.',
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
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { queueService, playerService, rankService, matchService, databaseService, config } = services;

  // Check if there's an active match
  const currentMatch = matchService.getCurrentMatch();
  if (currentMatch && currentMatch.status === 'in-progress') {
    await interaction.editReply('There is already a match in progress. Please wait for it to complete.');
    return;
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

    // Check if queue is full (async)
    if (await queueService.isFull()) {
      // Validate guild exists for voice channels
      if (!interaction.guild) {
        await interaction.editReply('❌ Cannot create match: guild not found.');
        return;
      }

      // Lock queue to prevent further joins
      queueService.lock();

      // Call Vercel Cloud Agent to process queue and create match
      const { vercelAPI } = services;
      const processResult = await vercelAPI.processQueue({
        balancingMode: config.teamBalancing.defaultMode,
      });

      if (!processResult.success || !processResult.match) {
        queueService.unlock();
        await interaction.editReply(
          `❌ Failed to create match: ${processResult.error || 'Unknown error'}`
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

    await interaction.editReply('✅ Queue is full! Match created. Check your team voice channels!');
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
      content: '❌ An error occurred while joining the queue. Please try again.',
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
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;

  try {
    const { queueService } = services;
    const result = await queueService.leave(userId);
    await interaction.editReply(result.message);
  } catch (error) {
    console.error('Queue leave error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while leaving the queue. Please try again.',
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
    config: Config;
  }
) {
  await interaction.deferReply();

  try {
    const { queueService, config } = services;
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
      value: queue.isLocked ? '🔒 Locked' : '✅ Open',
      inline: true,
    });

  if (queue.players.length > 0) {
    const playerList = queue.players
      .map((p, i) => {
        const rank = p.rank ? ` [${p.rank}]` : '';
        return `${i + 1}. ${p.username}${rank}`;
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
      content: '❌ An error occurred while fetching queue status. Please try again.',
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
    .setTitle('🎮 Match Created!')
    .setColor(0x00ff00)
    .addFields({
      name: 'Map',
      value: match.map,
      inline: true,
    })
    .addFields({
      name: 'Host',
      value: match.host.username,
      inline: true,
    })
    .addFields({
      name: 'Match ID',
      value: match.matchId,
      inline: true,
    });

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
    .addFields({ name: '🔵 Team A', value: teamAList || 'None', inline: true })
    .addFields({ name: '🔴 Team B', value: teamBList || 'None', inline: true });

  // Add voice channel info if available
  if (teamAChannel) {
    embed.addFields({
      name: '🔵 Team A Voice',
      value: `<#${teamAChannel.id}>`,
      inline: true,
    });
  }

  if (teamBChannel) {
    embed.addFields({
      name: '🔴 Team B Voice',
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
        content: '❌ This can only be used in a server.',
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
        content: '❌ Unknown button interaction.',
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

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        flags: MessageFlags.Ephemeral,
      });
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
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { queueService, playerService, rankService, matchService, databaseService, voiceChannelService, config } = services;

    // Check if there's an active match
    const currentMatch = matchService.getCurrentMatch();
    if (currentMatch && currentMatch.status === 'in-progress') {
      await interaction.editReply('❌ There is already a match in progress. Please wait for it to complete.');
      return;
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

    // Try to move user to queue lobby if it exists
    if (interaction.guild) {
      // Find queue lobby channel
      const queueLobbyChannel = interaction.guild.channels.cache.find(
        (ch: any) => ch.type === 2 && ch.name === '🎮 Queue Lobby' // ChannelType.GuildVoice = 2
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
        await interaction.editReply('❌ Cannot create match: guild not found.');
        return;
      }

      // Lock queue to prevent further joins
      queueService.lock();

      // Call Vercel Cloud Agent to process queue and create match
      const { vercelAPI } = services;
      const processResult = await vercelAPI.processQueue({
        balancingMode: config.teamBalancing.defaultMode,
      });

      if (!processResult.success || !processResult.match) {
        queueService.unlock();
        await interaction.editReply(
          `❌ Failed to create match: ${processResult.error || 'Unknown error'}`
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

      // Clear queue after match creation (async)
      await queueService.clear();
      queueService.unlock();

      // Update the original queue message to show match created
      await interaction.editReply('✅ Queue is full! Match created. Check your team voice channels!');
    } else {
      // Update the queue message with new player count
      const updatedEmbed = new EmbedBuilder()
        .setTitle('🎮 Queue Started!')
        .setDescription('Click the button below to join the queue!')
        .setColor(0x00ff00)
        .addFields({
          name: 'Players',
          value: `${queueSize}/${config.queue.maxPlayers}`,
          inline: true,
        })
        .addFields({
          name: 'Status',
          value: '✅ Open',
          inline: true,
        });

      if (queueSize > 0) {
        const playerList = queue.players
          .slice(0, 10) // Show first 10
          .map((p, i) => {
            const rank = p.rank ? ` [${p.rank}]` : '';
            return `${i + 1}. ${p.username}${rank}`;
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
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➕');

      const leaveButton = new ButtonBuilder()
        .setCustomId('queue_leave_button')
        .setLabel('Leave Queue')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('➖');

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(joinButton, leaveButton);

      // Update the original message
      await interaction.message?.edit({
        embeds: [updatedEmbed],
        components: [row],
      });

      await interaction.editReply(`✅ ${result.message}`);
    }
  } catch (error) {
    console.error('Join queue button error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while joining the queue. Please try again.',
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
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;

  try {
    const { queueService } = services;
    const result = await queueService.leave(userId);

    // Update queue message if it exists
    if (interaction.message) {
      const queue = await queueService.getStatus();
      const queueSize = queue.players.length;

      const updatedEmbed = new EmbedBuilder()
        .setTitle('🎮 Queue Started!')
        .setDescription('Click the button below to join the queue!')
        .setColor(0x00ff00)
        .addFields({
          name: 'Players',
          value: `${queueSize}/${services.config.queue.maxPlayers}`,
          inline: true,
        })
        .addFields({
          name: 'Status',
          value: '✅ Open',
          inline: true,
        });

      if (queueSize > 0) {
        const playerList = queue.players
          .slice(0, 10)
          .map((p, i) => {
            const rank = p.rank ? ` [${p.rank}]` : '';
            return `${i + 1}. ${p.username}${rank}`;
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
        .setStyle(ButtonStyle.Primary)
        .setEmoji('➕');

      const leaveButton = new ButtonBuilder()
        .setCustomId('queue_leave_button')
        .setLabel('Leave Queue')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('➖');

      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(joinButton, leaveButton);

      await interaction.message.edit({
        embeds: [updatedEmbed],
        components: [row],
      });
    }

    await interaction.editReply(result.message);
  } catch (error) {
    console.error('Leave queue button error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while leaving the queue. Please try again.',
    });
  }
}
