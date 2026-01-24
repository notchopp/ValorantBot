import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { MatchService } from '../services/MatchService';
import { DatabaseService } from '../services/DatabaseService';
import { PlayerService } from '../services/PlayerService';
import { Config } from '../config/config';

export const data = new SlashCommandBuilder()
  .setName('host')
  .setDescription('Host management commands')
  .addSubcommand((subcommand) =>
    subcommand.setName('info').setDescription('View current host information and invite code')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('confirm').setDescription('Confirm you are ready to host')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('pass').setDescription('Pass hosting to another player')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    matchService: MatchService;
    databaseService: DatabaseService;
    playerService: PlayerService;
    config: Config;
  }
) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'info') {
    await handleInfo(interaction, services);
  } else if (subcommand === 'confirm') {
    await handleConfirm(interaction, services);
  } else if (subcommand === 'pass') {
    await handlePass(interaction, services);
  }
}

function getMatchGameLabel(matchType?: string | null): string {
  return matchType === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant';
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  services: {
    matchService: MatchService;
    databaseService: DatabaseService;
    playerService: PlayerService;
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { matchService, databaseService } = services;
    const userId = interaction.user.id;
    
    // Try in-memory first, then fall back to database
    let currentMatch = matchService.getCurrentMatch();
    let dbMatch = currentMatch ? await databaseService.getMatch(currentMatch.matchId) : null;
    
    // If no in-memory match, try to find from database
    if (!currentMatch || !dbMatch) {
      dbMatch = await databaseService.getActiveMatchForUser(userId);
      if (!dbMatch) {
        dbMatch = await databaseService.getAnyActiveMatch();
      }
    }

    if (!dbMatch) {
      await interaction.editReply('❌ No active match found.');
      return;
    }

    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server.');
      return;
    }

    const hostUserId = dbMatch.host_user_id;
    const gameLabel = getMatchGameLabel(dbMatch.match_type);
    const hostMember = hostUserId ? await interaction.guild.members.fetch(hostUserId).catch(() => null) : null;

    const embed = new EmbedBuilder()
      .setTitle('🎮 Host Information')
      .setColor(0x0099ff)
      .addFields({
        name: 'Current Host',
        value: hostMember ? `<@${hostUserId}>` : (hostUserId || 'Unknown'),
        inline: true,
      })
      .addFields({
        name: 'Status',
        value: dbMatch.host_confirmed ? '✅ Confirmed' : '⏳ Pending',
        inline: true,
      })
      .addFields({
        name: 'Match Status',
        value: dbMatch.status || 'pending',
        inline: true,
      });

    if (dbMatch.map) {
      embed.addFields({
        name: 'Map',
        value: dbMatch.map,
        inline: true,
      });
    }

    embed.setDescription(`Match ID: \`${dbMatch.match_id}\`\nGame: ${gameLabel}`);

    // Show teams
    const teamA = (dbMatch.team_a as string[]) || [];
    const teamB = (dbMatch.team_b as string[]) || [];

    if (teamA.length > 0) {
      embed.addFields({
        name: `Team A (${teamA.length})`,
        value: teamA.map(id => `<@${id}>`).join(', ') || 'None',
        inline: false,
      });
    }

    if (teamB.length > 0) {
      embed.addFields({
        name: `Team B (${teamB.length})`,
        value: teamB.map(id => `<@${id}>`).join(', ') || 'None',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Host info error', {
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply('❌ An error occurred while fetching host information.');
  }
}

async function handleConfirm(
  interaction: ChatInputCommandInteraction,
  services: {
    matchService: MatchService;
    databaseService: DatabaseService;
    playerService: PlayerService;
    config: Config;
  }
) {
  try {
    const { matchService, databaseService } = services;
    const userId = interaction.user.id;
    
    // Try in-memory first, then fall back to database
    let currentMatch = matchService.getCurrentMatch();
    let dbMatch = currentMatch ? await databaseService.getMatch(currentMatch.matchId) : null;
    
    // If no in-memory match, try to find from database
    if (!currentMatch || !dbMatch) {
      dbMatch = await databaseService.getActiveMatchForUser(userId);
      if (!dbMatch) {
        dbMatch = await databaseService.getAnyActiveMatch();
      }
    }

    if (!dbMatch) {
      await interaction.reply({ content: '❌ No active match found.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (dbMatch.host_user_id !== userId) {
      await interaction.reply({ content: '❌ Only the selected host can confirm hosting.', flags: MessageFlags.Ephemeral });
      return;
    }

    if (dbMatch.host_confirmed) {
      await interaction.reply({ content: '✅ You have already confirmed hosting.', flags: MessageFlags.Ephemeral });
      return;
    }

    const gameLabel = getMatchGameLabel(dbMatch.match_type);

    // Host needs to provide the invite code from the game
    // We'll use a modal to get the code
    const modal = new ModalBuilder()
      .setCustomId(`host_confirm_modal_${dbMatch.match_id}`)
      .setTitle(`Enter ${gameLabel} Invite Code`);

    const codeInput = new TextInputBuilder()
      .setCustomId('invite_code')
      .setLabel(`${gameLabel} Invite Code`)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder(`Enter the code ${gameLabel} generated`)
      .setMinLength(4)
      .setMaxLength(10);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  } catch (error) {
    console.error('Host confirm error', {
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.reply({ content: '❌ An error occurred while confirming host.', flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handle host confirm modal submission
 */
export async function handleHostConfirmModal(
  interaction: ModalSubmitInteraction,
  services: {
    matchService: MatchService;
    databaseService: DatabaseService;
    playerService: PlayerService;
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { matchService, databaseService } = services;
    const userId = interaction.user.id;
    
    // Extract match ID from modal custom ID if present
    const customId = interaction.customId;
    const matchIdFromModal = customId.startsWith('host_confirm_modal_') 
      ? customId.replace('host_confirm_modal_', '') 
      : null;
    
    // Try in-memory first
    let currentMatch = matchService.getCurrentMatch();
    let dbMatch = currentMatch ? await databaseService.getMatch(currentMatch.matchId) : null;
    
    // If no in-memory, try from modal ID or find active match
    if (!dbMatch && matchIdFromModal) {
      dbMatch = await databaseService.getMatch(matchIdFromModal);
    }
    if (!dbMatch) {
      dbMatch = await databaseService.getActiveMatchForUser(userId);
    }
    if (!dbMatch) {
      dbMatch = await databaseService.getAnyActiveMatch();
    }

    if (!dbMatch) {
      await interaction.editReply('❌ No active match found.');
      return;
    }

    if (dbMatch.host_user_id !== userId) {
      await interaction.editReply('❌ Only the selected host can confirm hosting.');
      return;
    }

    const gameLabel = getMatchGameLabel(dbMatch.match_type);

    // Get invite code from modal
    const inviteCode = interaction.fields.getTextInputValue('invite_code').trim().toUpperCase();

    if (!inviteCode || inviteCode.length < 4) {
      await interaction.editReply(`❌ Invalid invite code. Please enter the code ${gameLabel} generated (at least 4 characters).`);
      return;
    }

    // Update in-memory match if exists
    if (currentMatch && currentMatch.matchId === dbMatch.match_id) {
      currentMatch.hostInviteCode = inviteCode;
      currentMatch.hostConfirmed = true;
      currentMatch.status = 'in-progress';
    }

    // Update database
    await databaseService.updateMatch(dbMatch.match_id, {
      host_invite_code: inviteCode,
      host_confirmed: true,
      status: 'in-progress',
    });

    // Post public message with invite code
    if (interaction.channel && 'send' in interaction.channel) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Host Confirmed!')
        .setDescription(`<@${userId}> has entered the ${gameLabel} invite code!`)
        .setColor(0x00ff00)
        .addFields({
          name: '🎮 Invite Code',
          value: `\`${inviteCode}\``,
          inline: false,
        })
        .addFields({
          name: 'Instructions',
          value: `Join the custom game in ${gameLabel} using the invite code above!`,
          inline: false,
        });

      await (interaction.channel as any).send({ embeds: [embed] });

      // Also send match starting notification
      const startEmbed = new EmbedBuilder()
        .setTitle('🎮 Match Starting!')
        .setDescription('Host has confirmed! Match is now in progress.')
        .setColor(0x00ff00)
        .addFields({
          name: 'Match ID',
          value: dbMatch.match_id,
          inline: true,
        })
        .addFields({
          name: 'Invite Code',
          value: `\`${inviteCode}\``,
          inline: true,
        });

      await (interaction.channel as any).send({ embeds: [startEmbed] });
    }

    await interaction.editReply('✅ Host confirmed! Invite code posted in channel.');
  } catch (error) {
    console.error('Host confirm modal error', {
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply('❌ An error occurred while processing the invite code.');
  }
}

async function handlePass(
  interaction: ChatInputCommandInteraction,
  services: {
    matchService: MatchService;
    databaseService: DatabaseService;
    playerService: PlayerService;
    config: Config;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { matchService, databaseService } = services;
    const userId = interaction.user.id;
    
    // Try in-memory first, then fall back to database
    let currentMatch = matchService.getCurrentMatch();
    let dbMatch = currentMatch ? await databaseService.getMatch(currentMatch.matchId) : null;
    
    // If no in-memory match, try to find from database
    if (!currentMatch || !dbMatch) {
      dbMatch = await databaseService.getActiveMatchForUser(userId);
      if (!dbMatch) {
        dbMatch = await databaseService.getAnyActiveMatch();
      }
    }

    if (!dbMatch) {
      await interaction.editReply('❌ No active match found.');
      return;
    }

    if (dbMatch.host_user_id !== userId) {
      await interaction.editReply('❌ Only the current host can pass hosting.');
      return;
    }

    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server.');
      return;
    }

    // Get all players from database match
    const teamA = (dbMatch.team_a as string[]) || [];
    const teamB = (dbMatch.team_b as string[]) || [];
    const allPlayerIds = [...teamA, ...teamB];
    const eligiblePlayerIds = allPlayerIds.filter((id) => id !== userId);

    if (eligiblePlayerIds.length === 0) {
      await interaction.editReply('❌ No other players available to pass hosting to.');
      return;
    }

    // Select random new host
    const newHostId = eligiblePlayerIds[Math.floor(Math.random() * eligiblePlayerIds.length)];

    // Update in-memory match if exists
    if (currentMatch && currentMatch.matchId === dbMatch.match_id) {
      const newHostPlayer = [...currentMatch.teams.teamA.players, ...currentMatch.teams.teamB.players]
        .find(p => p.userId === newHostId);
      if (newHostPlayer) {
        currentMatch.host = newHostPlayer;
        currentMatch.hostConfirmed = false;
        currentMatch.hostInviteCode = undefined;
        currentMatch.hostSelectedAt = new Date();
      }
    }

    // Update database
    await databaseService.updateMatch(dbMatch.match_id, {
      host_user_id: newHostId,
      host_confirmed: false,
      host_invite_code: null,
      host_selected_at: new Date().toISOString(),
    });

    const gameLabel = getMatchGameLabel(dbMatch.match_type);

    // Notify in channel
    if (interaction.channel && 'send' in interaction.channel) {
      const embed = new EmbedBuilder()
        .setTitle('🔄 Host Changed')
        .setDescription(`<@${userId}> passed hosting to <@${newHostId}>`)
        .setColor(0xff9900)
        .addFields({
          name: 'New Host',
          value: `<@${newHostId}>`,
          inline: false,
        })
        .addFields({
          name: 'Action Required',
          value: `New host must create a custom game in ${gameLabel} and use \`/host confirm\` to enter the invite code.`,
          inline: false,
        });

      await (interaction.channel as any).send({ embeds: [embed] });
    }

    await interaction.editReply(`✅ Hosting passed to <@${newHostId}>.`);
  } catch (error) {
    console.error('Host pass error', {
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply('❌ An error occurred while passing host.');
  }
}
