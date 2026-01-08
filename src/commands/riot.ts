import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { RiotIDService } from '../services/RiotIDService';
import { PlayerService } from '../services/PlayerService';
import { ValorantAPIService } from '../services/ValorantAPIService';

export const data = new SlashCommandBuilder()
  .setName('riot')
  .setDescription('Manage your Riot ID link')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('link')
      .setDescription('Link your Riot ID (name#tag)')
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
  }
) {
  await interaction.deferReply({ ephemeral: true });

  const { riotIDService, playerService, valorantAPI } = services;
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const name = interaction.options.getString('name', true);
  const tag = interaction.options.getString('tag', true);
  const region = interaction.options.getString('region') || undefined;

  // Get or create player first
  playerService.getOrCreatePlayer(userId, username);

  // Verify account exists via API
  if (valorantAPI) {
    const account = await valorantAPI.getAccount(name, tag);
    if (!account) {
      await interaction.editReply(
        `❌ Could not find Riot account "${name}#${tag}". Please check your username and tag.`
      );
      return;
    }

    // Auto-detect region if not provided
    const detectedRegion = region || account.region || 'na';
    
    await riotIDService.linkRiotID(userId, name, tag, detectedRegion);
    
    // Fetch and update rank immediately
    const player = await playerService.getPlayer(userId);
    if (player) {
      const mmr = await valorantAPI.getMMR(detectedRegion, name, tag);
      if (mmr) {
        player.rank = mmr.currenttierpatched;
        player.rankValue = valorantAPI.getRankValueFromMMR(mmr);
      }
    }

    await interaction.editReply(
      `✅ Successfully linked Riot ID: **${name}#${tag}** (Region: ${detectedRegion.toUpperCase()})`
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
  }
) {
  await interaction.deferReply({ ephemeral: true });

  const { riotIDService } = services;
  const userId = interaction.user.id;

    const unlinked = await riotIDService.unlinkRiotID(userId);
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
  }
) {
  await interaction.deferReply({ ephemeral: true });

  const { riotIDService, playerService, valorantAPI } = services;
  const userId = interaction.user.id;

  const riotId = riotIDService.getRiotID(userId);
    const player = await playerService.getPlayer(userId);

  if (!riotId) {
    await interaction.editReply('❌ You do not have a Riot ID linked. Use `/riot link` to link your account.');
    return;
  }

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

  if (player?.rank) {
    embed.addFields({
      name: 'Current Rank',
      value: player.rank,
      inline: true,
    });
  }

  // Fetch fresh data from API if available
  if (valorantAPI && riotId.region) {
    try {
      const mmr = await valorantAPI.getMMR(riotId.region, riotId.name, riotId.tag);
      if (mmr) {
        embed.addFields({
          name: 'MMR',
          value: mmr.elo.toString(),
          inline: true,
        });
        embed.addFields({
          name: 'Ranking in Tier',
          value: `#${mmr.ranking_in_tier}`,
          inline: true,
        });
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
  }
) {
  await interaction.deferReply({ ephemeral: true });

  const { playerService, valorantAPI } = services;
  const userId = interaction.user.id;

  if (!valorantAPI) {
    await interaction.editReply('❌ Valorant API is not available.');
    return;
  }

  const result = await playerService.fetchRankFromAPI(userId);
  
  if (result.success && result.rank) {
    await interaction.editReply(
      `✅ Rank refreshed: **${result.rank}** (Value: ${result.rankValue})`
    );
  } else {
    await interaction.editReply(
      `❌ ${result.message || 'Failed to refresh rank.'}`
    );
  }
}
