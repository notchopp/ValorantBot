import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { RiotIDService } from '../services/RiotIDService';
import { PlayerService } from '../services/PlayerService';
import { ValorantAPIService } from '../services/ValorantAPIService';
import { VercelAPIService } from '../services/VercelAPIService';
import { RoleUpdateService } from '../services/RoleUpdateService';
import { DatabaseService } from '../services/DatabaseService';
import { MarvelRivalsAPIService } from '../services/MarvelRivalsAPIService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';

export const data = new SlashCommandBuilder()
  .setName('account')
  .setDescription('Manage your game accounts (Valorant/Marvel Rivals)')
  .addSubcommandGroup((group) =>
    group
      .setName('riot')
      .setDescription('Manage your Riot ID (Valorant)')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('link')
          .setDescription('Link your Riot ID - stores your account info (use /verify after to get placed)')
          .addStringOption((option) =>
            option
              .setName('name')
              .setDescription('Your Riot username')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('tag')
              .setDescription('Your Riot tag (without #)')
              .setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName('region')
              .setDescription('Your region (na, eu, ap, kr, latam, br)')
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('unlink').setDescription('Unlink your Riot ID')
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('info').setDescription('View your linked Riot ID')
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('refresh').setDescription('Refresh your Valorant rank from API')
      )
  )
  .addSubcommandGroup((group) =>
    group
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
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    vercelAPI?: VercelAPIService;
    roleUpdateService?: RoleUpdateService;
    databaseService: DatabaseService;
    marvelRivalsAPI?: MarvelRivalsAPIService;
  }
) {
  const group = interaction.options.getSubcommandGroup();
  const subcommand = interaction.options.getSubcommand();

  if (group === 'riot') {
    if (subcommand === 'link') {
      await handleRiotLink(interaction, services);
    } else if (subcommand === 'unlink') {
      await handleRiotUnlink(interaction, services);
    } else if (subcommand === 'info') {
      await handleRiotInfo(interaction, services);
    } else if (subcommand === 'refresh') {
      await handleRiotRefresh(interaction, services);
    }
  } else if (group === 'marvel') {
    if (subcommand === 'link') {
      await handleMarvelLink(interaction, services);
    } else if (subcommand === 'unlink') {
      await handleMarvelUnlink(interaction, services);
    } else if (subcommand === 'info') {
      await handleMarvelInfo(interaction, services);
    }
  }
}

// ==================== RIOT HANDLERS ====================

async function handleRiotLink(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    databaseService: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn(`Riot link interaction timed out for user ${userId}`);
      return;
    }
    throw error;
  }

  const { riotIDService, playerService, valorantAPI, databaseService } = services;
  const username = interaction.user.username;
  const nameRaw = interaction.options.getString('name', true);
  const tagRaw = interaction.options.getString('tag', true);
  const region = interaction.options.getString('region') || undefined;

  const name = nameRaw.trim();
  const tag = String(tagRaw).trim();

  await playerService.getOrCreatePlayer(userId, username);

  if (valorantAPI) {
    console.log('Verifying Riot account via API', { name, tag });
    const account = await valorantAPI.getAccount(name, tag);
    if (!account) {
      await interaction.editReply(
        `❌ Could not find Riot account "${name}#${tag}".\n\n` +
        `**Possible reasons:**\n` +
        `• The Riot ID may have changed (check your current in-game name)\n` +
        `• Make sure you're using your **current** Riot ID\n` +
        `• Verify the tag is correct\n\n` +
        `**To find your current Riot ID:**\n` +
        `1. Open Valorant\n` +
        `2. Check the top-left corner of the main menu`
      );
      return;
    }

    const detectedRegion = region || account.region || 'na';
    
    const dbUpdateSuccess = await databaseService.updatePlayerRiotID(
      userId,
      name,
      tag,
      account.puuid,
      detectedRegion
    );
    
    if (!dbUpdateSuccess) {
      console.error('Failed to update database with Riot ID', { userId, name, tag });
    }
    
    await riotIDService.linkRiotID(userId, name, tag, detectedRegion, account.puuid);

    await interaction.editReply(
      `✅ Successfully linked Riot ID: **${name}#${tag}** (Region: ${detectedRegion.toUpperCase()})\n\nNow use \`/verify\` to get your initial Discord rank placement!`
    );
  } else {
    await riotIDService.linkRiotID(userId, name, tag, region);
    await interaction.editReply(
      `✅ Successfully linked Riot ID: **${name}#${tag}**`
    );
  }
}

async function handleRiotUnlink(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    roleUpdateService?: RoleUpdateService;
    databaseService: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  await safeDefer(interaction, true);

  const { riotIDService, roleUpdateService, databaseService } = services;

  const dbPlayer = await databaseService.getPlayer(userId);
  console.log('Unlink attempt', { 
    userId, 
    hasRiotIDInDB: !!(dbPlayer?.riot_name && dbPlayer?.riot_tag),
  });

  const unlinked = await riotIDService.unlinkRiotID(userId);
  
  if (unlinked && interaction.guild && roleUpdateService) {
    try {
      await roleUpdateService.removeAllRankRoles(userId, interaction.guild);
    } catch (error) {
      console.warn('Failed to remove rank roles after unlink', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  if (unlinked) {
    await safeEditReply(interaction, '✅ Successfully unlinked your Riot ID.\n\n🗑️ Your Valorant rank and MMR have been cleared. Use `/verify game:valorant` to re-verify after linking a new account.');
  } else {
    await safeEditReply(interaction, '❌ You do not have a Riot ID linked.');
  }
}

async function handleRiotInfo(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    databaseService: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  await safeDefer(interaction, true);

  const { riotIDService, databaseService, valorantAPI } = services;
  const riotId = await riotIDService.getRiotID(userId);

  if (!riotId) {
    await interaction.editReply('❌ You do not have a Riot ID linked. Use `/account riot link` to link your account.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎮 Riot ID Information')
    .setColor(0x00ff00)
    .addFields({
      name: 'Riot ID',
      value: `${riotId.name}#${riotId.tag}`,
      inline: true,
    })
    .addFields({
      name: 'Region',
      value: (riotId.region || 'N/A').toUpperCase(),
      inline: true,
    });

  const dbPlayer = await databaseService.getPlayer(userId);
  if (dbPlayer?.discord_rank && dbPlayer.discord_rank !== 'Unranked') {
    embed.addFields({
      name: 'Discord Rank',
      value: dbPlayer.discord_rank,
      inline: true,
    });
    if (dbPlayer.current_mmr !== undefined) {
      embed.addFields({
        name: 'Discord MMR',
        value: dbPlayer.current_mmr.toString(),
        inline: true,
      });
    }
  }

  if (valorantAPI && riotId.region) {
    try {
      const mmr = await valorantAPI.getMMR(riotId.region, riotId.name, riotId.tag);
      if (mmr && mmr.currenttierpatched) {
        embed.addFields({
          name: 'Valorant Rank',
          value: mmr.currenttierpatched,
          inline: true,
        });
        embed.addFields({
          name: 'Valorant MMR',
          value: mmr.elo.toString(),
          inline: true,
        });
      }
    } catch (error) {
      // Silently fail
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleRiotRefresh(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    vercelAPI?: VercelAPIService;
    roleUpdateService?: RoleUpdateService;
    databaseService: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  await safeDefer(interaction, true);

  const { riotIDService, vercelAPI, roleUpdateService, databaseService, playerService } = services;

  const riotId = await riotIDService.getRiotID(userId);
  if (!riotId) {
    await interaction.editReply('❌ No Riot ID linked. Use `/account riot link` to link your account first.');
    return;
  }

  const player = await databaseService.getPlayer(userId);
  if (!player || !player.discord_rank || player.discord_rank === 'Unranked') {
    await interaction.editReply('❌ You need to verify first using `/verify` before you can refresh your rank.');
    return;
  }

  if (!vercelAPI) {
    await interaction.editReply('❌ Vercel API is not available.');
    return;
  }

  const refreshResult = await vercelAPI.refreshRank({
    userId,
    riotName: riotId.name,
    riotTag: riotId.tag,
    region: riotId.region || 'na',
  });

  if (!refreshResult.success) {
    await interaction.editReply(
      `❌ ${refreshResult.error || 'Failed to refresh rank. Please try again later.'}`
    );
    return;
  }

  if (refreshResult.discordRank && refreshResult.discordRankValue !== undefined && refreshResult.newMMR !== undefined) {
    await databaseService.updatePlayerRank(
      userId,
      refreshResult.discordRank,
      refreshResult.discordRankValue,
      refreshResult.newMMR,
      'valorant'
    );
  }

  if (refreshResult.discordRank && refreshResult.oldRank && interaction.guild && roleUpdateService) {
    try {
      await roleUpdateService.updatePlayerRole(
        userId,
        refreshResult.oldRank,
        refreshResult.discordRank,
        interaction.guild
      );
    } catch (error) {
      console.warn('Failed to update Discord role after refresh', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  playerService.invalidateCache(userId);

  const embed = new EmbedBuilder()
    .setTitle('✅ Valorant Rank Refreshed!')
    .setColor(refreshResult.boosted ? 0x00ff00 : 0x0099ff)
    .addFields(
      { name: 'Riot ID', value: `${riotId.name}#${riotId.tag}`, inline: true },
      { name: 'Region', value: (riotId.region || 'N/A').toUpperCase(), inline: true },
      { name: 'Valorant Rank', value: refreshResult.valorantRank || 'Unrated', inline: true },
      { name: 'Old Discord Rank', value: refreshResult.oldRank || 'Unknown', inline: true },
      { name: 'New Discord Rank', value: refreshResult.discordRank || 'Unknown', inline: true },
      { name: 'New MMR', value: refreshResult.newMMR?.toString() || '0', inline: true }
    )
    .setDescription(refreshResult.message || 'Rank refreshed successfully.');

  await interaction.editReply({ embeds: [embed] });
}

// ==================== MARVEL HANDLERS ====================

async function handleMarvelLink(
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

async function handleMarvelUnlink(
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
  await safeEditReply(interaction, '✅ Marvel Rivals account unlinked.\n\n🗑️ Your Marvel Rivals rank and MMR have been cleared. Use `/verify game:marvel_rivals` to re-verify after linking a new account.');
}

async function handleMarvelInfo(
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
    await safeEditReply(interaction, '❌ You do not have a Marvel Rivals account linked. Use `/account marvel link`.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🦸 Marvel Rivals Account')
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
