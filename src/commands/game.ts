import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { RoleUpdateService } from '../services/RoleUpdateService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';

export const data = new SlashCommandBuilder()
  .setName('game')
  .setDescription('Manage your game preferences')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('set')
      .setDescription('Set preferred or primary game and role mode')
      .addStringOption((option) =>
        option
          .setName('preferred')
          .setDescription('Queue preference')
          .addChoices(
            { name: 'Valorant', value: 'valorant' },
            { name: 'Marvel Rivals', value: 'marvel_rivals' }
          )
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('primary')
          .setDescription('Primary game for Discord role')
          .addChoices(
            { name: 'Valorant', value: 'valorant' },
            { name: 'Marvel Rivals', value: 'marvel_rivals' }
          )
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('mode')
          .setDescription('Role mode (highest or primary)')
          .addChoices(
            { name: 'Highest Rank', value: 'highest' },
            { name: 'Primary Game', value: 'primary' }
          )
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName('info').setDescription('View your game preferences')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    roleUpdateService?: RoleUpdateService;
  }
) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    await handleSet(interaction, services);
  } else if (subcommand === 'info') {
    await handleInfo(interaction, services);
  }
}

function formatGameName(game: string): string {
  return game === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant';
}

async function handleSet(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    roleUpdateService?: RoleUpdateService;
  }
) {
  await safeDefer(interaction, true);

  const userId = interaction.user.id;
  const preferred = interaction.options.getString('preferred') as 'valorant' | 'marvel_rivals' | null;
  const primary = interaction.options.getString('primary') as 'valorant' | 'marvel_rivals' | null;
  const mode = interaction.options.getString('mode') as 'highest' | 'primary' | null;

  if (!preferred && !primary && !mode) {
    await safeEditReply(interaction, '❌ Provide at least one option to update.');
    return;
  }

  const { databaseService, roleUpdateService } = services;

  if (preferred) {
    await databaseService.setPlayerPreferredGame(userId, preferred);
  }

  if (primary) {
    await databaseService.setPlayerPrimaryGame(userId, primary);
  }

  if (mode) {
    await databaseService.setPlayerRoleMode(userId, mode);
  }

  if (interaction.guild && roleUpdateService) {
    await roleUpdateService.updatePlayerRoleFromDatabase(userId, interaction.guild);
  }

  const updated = await databaseService.getPlayer(userId);
  if (!updated) {
    await safeEditReply(interaction, '❌ Could not load updated preferences.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('✅ Game Preferences Updated')
    .setColor(0x00ff00)
    .addFields(
      { name: 'Preferred', value: formatGameName(updated.preferred_game || 'valorant'), inline: true },
      { name: 'Primary', value: formatGameName(updated.primary_game || 'valorant'), inline: true },
      { name: 'Role Mode', value: updated.role_mode || 'highest', inline: true }
    );

  await safeEditReply(interaction, { embeds: [embed] });
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  services: { databaseService: DatabaseService }
) {
  await safeDefer(interaction, true);

  const userId = interaction.user.id;
  const { databaseService } = services;

  const player = await databaseService.getPlayer(userId);
  if (!player) {
    await safeEditReply(interaction, '❌ You are not verified yet. Use `/verify` to get started.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Game Preferences')
    .setColor(0x0099ff)
    .addFields(
      { name: 'Preferred', value: formatGameName(player.preferred_game || 'valorant'), inline: true },
      { name: 'Primary', value: formatGameName(player.primary_game || 'valorant'), inline: true },
      { name: 'Role Mode', value: player.role_mode || 'highest', inline: true },
      {
        name: 'Valorant Rank',
        value: player.valorant_rank ? `${player.valorant_rank} (${player.valorant_mmr || 0} MMR)` : 'Unranked',
        inline: false,
      },
      {
        name: 'Marvel Rivals Rank',
        value: player.marvel_rivals_rank ? `${player.marvel_rivals_rank} (${player.marvel_rivals_mmr || 0} MMR)` : 'Unranked',
        inline: false,
      }
    );

  await safeEditReply(interaction, { embeds: [embed] });
}
