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

export const data = new SlashCommandBuilder()
  .setName('riot')
  .setDescription('Manage your Riot ID link')
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
    subcommand.setName('refresh').setDescription('Refresh your rank from API')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    vercelAPI?: VercelAPIService;
    roleUpdateService?: RoleUpdateService;
    databaseService?: DatabaseService;
  }
) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'link') {
    await handleLink(interaction, services);
  } else if (subcommand === 'unlink') {
    await handleUnlink(interaction, services);
  } else if (subcommand === 'info') {
    await handleInfo(interaction, services);
  } else if (subcommand === 'refresh') {
    await handleRefresh(interaction, services);
  }
}

async function handleLink(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    databaseService?: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  
  // Defer reply immediately to prevent timeout (3 second limit)
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn(`Riot link interaction timed out for user ${userId} - interaction may have expired`);
      return;
    }
    throw error;
  }

  const { riotIDService, playerService, valorantAPI, databaseService } = services;
  const username = interaction.user.username;
  const nameRaw = interaction.options.getString('name', true);
  const tagRaw = interaction.options.getString('tag', true);
  const region = interaction.options.getString('region') || undefined;

  // Normalize inputs (ensure tags are strings, handle numeric tags like "1017")
  const name = nameRaw.trim();
  const tag = String(tagRaw).trim(); // Ensure tag is always a string

  // Get or create player first
  await playerService.getOrCreatePlayer(userId, username);

  // Verify account exists via API
  if (valorantAPI) {
    console.log('Verifying Riot account via API', { name, tag, tagType: typeof tag });
    const account = await valorantAPI.getAccount(name, tag);
    if (!account) {
      // Provide helpful error message about name changes
      await interaction.editReply(
        `❌ Could not find Riot account "${name}#${tag}".\n\n` +
        `**Possible reasons:**\n` +
        `• The Riot ID may have changed (check your current in-game name)\n` +
        `• Make sure you're using your **current** Riot ID, not a past name\n` +
        `• Verify the tag is correct (tags can be numbers like "1017" or letters)\n` +
        `• Try checking your Riot ID in the Valorant game client\n\n` +
        `**To find your current Riot ID:**\n` +
        `1. Open Valorant\n` +
        `2. Check the top-left corner of the main menu\n` +
        `3. Your current Riot ID will be displayed there\n\n` +
        `Once you have your current Riot ID, try again with \`/riot link\`.`
      );
      return;
    }

    // Auto-detect region if not provided
    const detectedRegion = region || account.region || 'na';
    
    // Update database first if available (ensures Supabase gets updated)
    if (databaseService) {
      const dbUpdateSuccess = await databaseService.updatePlayerRiotID(
        userId,
        name,
        tag,
        account.puuid,
        detectedRegion
      );
      
      if (!dbUpdateSuccess) {
        console.error('Failed to update database with Riot ID', {
          userId,
          name,
          tag,
          puuid: account.puuid,
          region: detectedRegion,
        });
      }
    }
    
    // Link Riot ID in memory (stores account info, no Discord rank assignment)
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

async function handleUnlink(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    roleUpdateService?: RoleUpdateService;
    databaseService?: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  
  // Defer reply immediately to prevent timeout (3 second limit)
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn(`Riot unlink interaction timed out for user ${userId} - interaction may have expired`);
      return;
    }
    throw error;
  }

  const { riotIDService, roleUpdateService } = services;

  const unlinked = await riotIDService.unlinkRiotID(userId);
  
  // Remove Discord rank role when unlinking
  if (unlinked && interaction.guild && roleUpdateService) {
    try {
      console.log('🗑️ Removing rank roles after unlink', { userId });
      await roleUpdateService.removeAllRankRoles(userId, interaction.guild);
      console.log('✅ Removed rank roles after unlink', { userId });
    } catch (error) {
      console.warn('⚠️ Failed to remove rank roles after unlink', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue - role removal is non-critical
    }
  }
  
  if (unlinked) {
    await interaction.editReply('✅ Successfully unlinked your Riot ID.');
  } else {
    await interaction.editReply('❌ You do not have a Riot ID linked.');
  }
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    databaseService?: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  
  // Defer reply immediately to prevent timeout (3 second limit)
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn(`Riot info interaction timed out for user ${userId} - interaction may have expired`);
      return;
    }
    throw error;
  }

  const { riotIDService, playerService, databaseService } = services;

  // Try to get Riot ID from memory first, then from database
  let riotId = riotIDService.getRiotID(userId);
  
  // If not in memory, try database
  if (!riotId && databaseService) {
    const dbPlayer = await databaseService.getPlayer(userId);
    if (dbPlayer?.riot_name && dbPlayer?.riot_tag) {
      // Load into memory for future use
      await riotIDService.linkRiotID(
        userId,
        dbPlayer.riot_name,
        dbPlayer.riot_tag,
        dbPlayer.riot_region || undefined,
        dbPlayer.riot_puuid || undefined
      );
      riotId = riotIDService.getRiotID(userId);
    }
  }

  if (!riotId) {
    await interaction.editReply('❌ You do not have a Riot ID linked. Use `/riot link` to link your account.');
    return;
  }

  // Force refresh from database to get latest data
  const player = await playerService.getPlayer(userId, true);

  const embed = new EmbedBuilder()
    .setTitle('Riot ID Information')
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

  // Get Discord rank from database if available
  if (databaseService) {
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
  } else if (player?.rank) {
    embed.addFields({
      name: 'Current Rank',
      value: player.rank,
      inline: true,
    });
  }

  // Add Valorant rank from API if available
  const { valorantAPI } = services;
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
        if (mmr.ranking_in_tier > 0) {
          embed.addFields({
            name: 'Ranking in Tier',
            value: `#${mmr.ranking_in_tier}`,
            inline: true,
          });
        }
      }
    } catch (error) {
      // Silently fail, just show cached data
    }
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleRefresh(
  interaction: ChatInputCommandInteraction,
  services: {
    riotIDService: RiotIDService;
    playerService: PlayerService;
    valorantAPI?: ValorantAPIService;
    vercelAPI?: VercelAPIService;
    roleUpdateService?: RoleUpdateService;
    databaseService?: DatabaseService;
  }
) {
  const userId = interaction.user.id;
  const username = interaction.user.username;
  
  // Defer reply immediately to prevent timeout (3 second limit)
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn(`Riot refresh interaction timed out for user ${userId} - interaction may have expired`);
      return;
    }
    throw error;
  }

  const { riotIDService, vercelAPI, roleUpdateService, databaseService } = services;

  // Check if Riot ID is linked
  const riotId = riotIDService.getRiotID(userId);
  if (!riotId) {
    await interaction.editReply('❌ No Riot ID linked. Use `/riot link` to link your account first.');
    return;
  }

  // Check if player exists in database
  const player = databaseService ? await databaseService.getPlayer(userId) : null;
  if (!player || !player.discord_rank || player.discord_rank === 'Unranked') {
    await interaction.editReply('❌ You need to verify first using `/verify` before you can refresh your rank.');
    return;
  }

  if (!vercelAPI) {
    await interaction.editReply('❌ Vercel API is not available.');
    return;
  }

  console.log('Calling Vercel refreshRank for user:', { userId, username });
  const refreshResult = await vercelAPI.refreshRank({
    userId,
    riotName: riotId.name,
    riotTag: riotId.tag,
    region: riotId.region || 'na',
  });
  console.log('Vercel refreshRank response:', refreshResult);

  if (!refreshResult.success) {
    await interaction.editReply(
      `❌ ${refreshResult.error || 'Failed to refresh rank. Please try again later.'}`
    );
    return;
  }

  // Update Discord role if rank changed
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

  // Invalidate cache
  services.playerService.invalidateCache(userId);

  const embed = new EmbedBuilder()
    .setTitle('✅ Rank Refreshed!')
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
