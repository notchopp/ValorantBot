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
    const currentMatch = matchService.getCurrentMatch();

    if (!currentMatch) {
      await interaction.editReply('❌ No active match found.');
      return;
    }

    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server.');
      return;
    }

    // Get host info from database
    const dbMatch = await databaseService.getMatch(currentMatch.matchId);
    if (!dbMatch) {
      await interaction.editReply('❌ Match not found in database.');
      return;
    }

    const hostPlayer = currentMatch.host;
    const hostMember = await interaction.guild.members.fetch(hostPlayer.userId).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle('🎮 Host Information')
      .setColor(0x0099ff)
      .addFields({
        name: 'Current Host',
        value: hostMember ? `<@${hostPlayer.userId}>` : hostPlayer.username,
        inline: true,
      })
      .addFields({
        name: 'Status',
        value: currentMatch.hostConfirmed ? '✅ Confirmed' : '⏳ Pending',
        inline: true,
      });

    if (currentMatch.hostInviteCode) {
      embed.addFields({
        name: 'Invite Code',
        value: `\`${currentMatch.hostInviteCode}\``,
        inline: false,
      });
      embed.setDescription('Share this invite code with all players in the queue!');
    } else {
      embed.setDescription('Host must create a custom game in Valorant and use `/host confirm` to enter the invite code Valorant generates.');
    }

    // Show all players in queue
    const allPlayers = [...currentMatch.teams.teamA.players, ...currentMatch.teams.teamB.players];
    const playerList = allPlayers
      .map((p, i) => {
        const isHost = p.userId === hostPlayer.userId;
        return `${i + 1}. ${isHost ? '👑 ' : ''}${p.username}`;
      })
      .join('\n');

    embed.addFields({
      name: 'Players in Match',
      value: playerList || 'None',
      inline: false,
    });

    if (currentMatch.hostSelectedAt) {
      const timeSinceSelection = Date.now() - currentMatch.hostSelectedAt.getTime();
      const minutesElapsed = Math.floor(timeSinceSelection / 60000);
      const timeRemaining = Math.max(0, 10 - minutesElapsed);
      
      if (timeRemaining > 0 && !currentMatch.hostConfirmed) {
        embed.addFields({
          name: '⏰ Time Remaining',
          value: `${timeRemaining} minute(s) until auto-host selection`,
          inline: false,
        });
      }
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
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { matchService } = services;
    const currentMatch = matchService.getCurrentMatch();
    const userId = interaction.user.id;

    if (!currentMatch) {
      await interaction.editReply('❌ No active match found.');
      return;
    }

    if (currentMatch.host.userId !== userId) {
      await interaction.editReply('❌ Only the selected host can confirm hosting.');
      return;
    }

    if (currentMatch.hostConfirmed) {
      await interaction.editReply('✅ You have already confirmed hosting.');
      return;
    }

    // Host needs to provide the invite code from Valorant
    // We'll use a modal to get the code
    const modal = new ModalBuilder()
      .setCustomId('host_confirm_modal')
      .setTitle('Enter Valorant Invite Code');

    const codeInput = new TextInputBuilder()
      .setCustomId('invite_code')
      .setLabel('Valorant Invite Code')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Enter the code Valorant generated')
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
    await interaction.editReply('❌ An error occurred while confirming host.');
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
    const currentMatch = matchService.getCurrentMatch();
    const userId = interaction.user.id;

    if (!currentMatch) {
      await interaction.editReply('❌ No active match found.');
      return;
    }

    if (currentMatch.host.userId !== userId) {
      await interaction.editReply('❌ Only the selected host can confirm hosting.');
      return;
    }

    // Get invite code from modal
    const inviteCode = interaction.fields.getTextInputValue('invite_code').trim().toUpperCase();

    if (!inviteCode || inviteCode.length < 4) {
      await interaction.editReply('❌ Invalid invite code. Please enter the code Valorant generated (at least 4 characters).');
      return;
    }

    // Update match with invite code and confirmation
    currentMatch.hostInviteCode = inviteCode;
    currentMatch.hostConfirmed = true;

    // Update database
    await databaseService.updateMatch(currentMatch.matchId, {
      host_invite_code: inviteCode,
      host_confirmed: true,
    });

    // Update match status to in-progress now that host is confirmed
    currentMatch.status = 'in-progress';
    await databaseService.updateMatch(currentMatch.matchId, {
      status: 'in-progress',
    });

    // Post public message with invite code
    if (interaction.channel && 'send' in interaction.channel) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Host Confirmed!')
        .setDescription(`<@${userId}> has entered the Valorant invite code!`)
        .setColor(0x00ff00)
        .addFields({
          name: '🎮 Invite Code',
          value: `\`${inviteCode}\``,
          inline: false,
        })
        .addFields({
          name: 'Instructions',
          value: 'Join the custom game in Valorant using the invite code above!',
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
          value: currentMatch.matchId,
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
    const currentMatch = matchService.getCurrentMatch();
    const userId = interaction.user.id;

    if (!currentMatch) {
      await interaction.editReply('❌ No active match found.');
      return;
    }

    if (currentMatch.host.userId !== userId) {
      await interaction.editReply('❌ Only the current host can pass hosting.');
      return;
    }

    if (!interaction.guild) {
      await interaction.editReply('❌ This command can only be used in a server.');
      return;
    }

    // Get all players except current host
    const allPlayers = [...currentMatch.teams.teamA.players, ...currentMatch.teams.teamB.players];
    const eligiblePlayers = allPlayers.filter((p) => p.userId !== userId);

    if (eligiblePlayers.length === 0) {
      await interaction.editReply('❌ No other players available to pass hosting to.');
      return;
    }

    // Select random new host
    const newHost = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];

    // Update match
    currentMatch.host = newHost;
    currentMatch.hostConfirmed = false;
    currentMatch.hostInviteCode = undefined;
    currentMatch.hostSelectedAt = new Date();

    // Update database
    await databaseService.updateMatch(currentMatch.matchId, {
      host_user_id: newHost.userId,
      host_confirmed: false,
      host_invite_code: null,
      host_selected_at: new Date().toISOString(),
    });

    // Notify in channel
    if (interaction.channel && 'send' in interaction.channel) {
      const embed = new EmbedBuilder()
        .setTitle('🔄 Host Changed')
        .setDescription(`<@${userId}> passed hosting to <@${newHost.userId}>`)
        .setColor(0xff9900)
        .addFields({
          name: 'New Host',
          value: `<@${newHost.userId}>`,
          inline: false,
        })
        .addFields({
          name: 'Action Required',
          value: 'New host must create a custom game in Valorant and use `/host confirm` to enter the invite code.',
          inline: false,
        });

      await (interaction.channel as any).send({ embeds: [embed] });
    }

    await interaction.editReply(`✅ Hosting passed to <@${newHost.userId}>.`);
  } catch (error) {
    console.error('Host pass error', {
      userId: interaction.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await interaction.editReply('❌ An error occurred while passing host.');
  }
}
