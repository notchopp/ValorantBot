import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { MarvelRivalsAPIService } from '../services/MarvelRivalsAPIService';
import { PlayerService } from '../services/PlayerService';
import { RoleUpdateService } from '../services/RoleUpdateService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';

export const data = new SlashCommandBuilder()
  .setName('marvel')
  .setDescription('Manage your Marvel Rivals account')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('link')
      .setDescription('Link your Marvel Rivals username')
      .addStringOption((option) =>
        option
          .setName('username')
          .setDescription('Your Marvel Rivals username')
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('unlink').setDescription('Unlink your Marvel Rivals account')
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('info').setDescription('View your linked Marvel Rivals account')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    playerService: PlayerService;
    marvelRivalsAPI?: MarvelRivalsAPIService;
    roleUpdateService?: RoleUpdateService;
  }
) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'link') {
    await handleLink(interaction, services);
  } else if (subcommand === 'unlink') {
    await handleUnlink(interaction, services);
  } else if (subcommand === 'info') {
    await handleInfo(interaction, services);
  }
}

async function handleLink(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    playerService: PlayerService;
    marvelRivalsAPI?: MarvelRivalsAPIService;
  }
) {
  await safeDefer(interaction, true);

  const userId = interaction.user.id;
  const username = interaction.options.getString('username', true).trim();
  const { databaseService, playerService, marvelRivalsAPI } = services;

  if (!marvelRivalsAPI) {
    await safeEditReply(interaction, '❌ Marvel Rivals API service is not available.');
    return;
  }

  const player = await marvelRivalsAPI.searchPlayer(username);
  if (!player) {
    await safeEditReply(
      interaction,
      `❌ Could not find Marvel Rivals account "${username}". Please check the username and try again.`
    );
    return;
  }

  const updated = await databaseService.updatePlayerMarvelRivalsID(userId, player.uid, player.username);
  if (!updated) {
    await safeEditReply(interaction, '❌ Failed to link Marvel Rivals account. Please try again.');
    return;
  }

  await databaseService.setPlayerPreferredGame(userId, 'marvel_rivals');
  playerService.invalidateCache(userId);

  const embed = new EmbedBuilder()
    .setTitle('✅ Marvel Rivals Linked')
    .setColor(0x00ff00)
    .addFields(
      { name: 'Username', value: player.username, inline: true },
      { name: 'UID', value: player.uid, inline: true }
    )
    .setFooter({ text: 'Use /verify game:marvel_rivals to get placed.' });

  await safeEditReply(interaction, { embeds: [embed] });
}

async function handleUnlink(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    playerService: PlayerService;
    roleUpdateService?: RoleUpdateService;
  }
) {
  await safeDefer(interaction, true);

  const userId = interaction.user.id;
  const { databaseService, playerService, roleUpdateService } = services;

  const player = await databaseService.getPlayer(userId);
  if (!player?.marvel_rivals_uid) {
    await safeEditReply(interaction, '❌ You do not have a Marvel Rivals account linked.');
    return;
  }

  const unlinked = await databaseService.unlinkPlayerMarvelRivalsID(userId);
  if (!unlinked) {
    await safeEditReply(interaction, '❌ Failed to unlink Marvel Rivals account.');
    return;
  }

  if (player.preferred_game === 'marvel_rivals') {
    await databaseService.setPlayerPreferredGame(userId, 'valorant');
  }

  if (interaction.guild && roleUpdateService) {
    await roleUpdateService.updatePlayerRoleFromDatabase(userId, interaction.guild);
  }

  playerService.invalidateCache(userId);
  await safeEditReply(interaction, '✅ Marvel Rivals account unlinked.');
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
  }
) {
  await safeDefer(interaction, true);

  const userId = interaction.user.id;
  const { databaseService } = services;

  const player = await databaseService.getPlayer(userId);
  if (!player?.marvel_rivals_uid || !player.marvel_rivals_username) {
    await safeEditReply(interaction, '❌ You do not have a Marvel Rivals account linked.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Marvel Rivals Account')
    .setColor(0x0099ff)
    .addFields(
      { name: 'Username', value: player.marvel_rivals_username, inline: true },
      { name: 'UID', value: player.marvel_rivals_uid, inline: true },
      {
        name: 'Discord Rank',
        value: player.marvel_rivals_rank ? `${player.marvel_rivals_rank} (${player.marvel_rivals_mmr || 0} MMR)` : 'Unranked',
        inline: true,
      }
    );

  await safeEditReply(interaction, { embeds: [embed] });
}
