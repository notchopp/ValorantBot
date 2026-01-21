import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { RankCalculationService } from '../services/RankCalculationService';
import { RankCardService } from '../services/RankCardService';
import { RankProfileImageService } from '../services/RankProfileImageService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';
import { GAME_CHOICES, getGameRankFields, resolveGameForPlayer, formatGameName, getMatchTypesForGame } from '../utils/game-selection';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('View your Discord rank, MMR, and progression')
  .addStringOption((option) =>
    option.setName('game').setDescription('Choose which game to display').addChoices(...GAME_CHOICES)
  );

// Also create /mmr as alias
export const mmrData = new SlashCommandBuilder()
  .setName('mmr')
  .setDescription('View your Discord rank, MMR, and progression (alias for /rank)');

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    rankCalculationService: RankCalculationService;
    rankCardService?: RankCardService;
    rankProfileImageService?: RankProfileImageService;
  }
) {
  // Defer IMMEDIATELY before any async operations
  await safeDefer(interaction, true);

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { databaseService, rankCalculationService } = services;

    // Get player data
    const player = await databaseService.getPlayer(userId);
    if (!player) {
      await safeEditReply(interaction, {
        content: '❌ You are not verified. Use `/verify` to link your account and get placed.',
      });
      return;
    }

    const selectedGame = resolveGameForPlayer(player, interaction.options.getString('game'));
    // Get rank progression
    const progression = await rankCalculationService.getRankProgression(userId, selectedGame);

    if (!progression) {
      await safeEditReply(interaction, {
        content: '❌ Could not fetch rank information.',
      });
      return;
    }

  const matchSummary = await databaseService.getPlayerMatchSummary(userId, {
    matchTypes: getMatchTypesForGame(selectedGame),
  });
  const summaryStats = matchSummary?.stats || getEmptyMatchStats();

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s Ranks`)
    .setColor(getRankColor(progression.currentRank))
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      {
        name: 'Discord Role',
        value: `**${progression.currentRank}**`,
        inline: true,
      },
      {
        name: 'Discord MMR',
        value: `**${progression.currentMMR}**`,
        inline: true,
      }
    );

  const { rank: gameRank, mmr: gameMMR, peak: gamePeak } = getGameRankFields(player, selectedGame);
  const valorantRank = player.valorant_rank || player.discord_rank || 'Unranked';
  const valorantMMR = player.valorant_mmr || player.current_mmr || 0;
  const marvelRank = player.marvel_rivals_rank || 'Unranked';
  const marvelMMR = player.marvel_rivals_mmr || 0;

  embed.addFields(
    {
      name: 'Marvel Rivals',
      value: `**${marvelRank}**\n${marvelMMR} MMR`,
      inline: true,
    },
    {
      name: 'Valorant',
      value: `**${valorantRank}**\n${valorantMMR} MMR`,
      inline: true,
    },
    {
      name: `${formatGameName(selectedGame)} Focus`,
      value: `**${gameRank}**\n${gameMMR} MMR`,
      inline: true,
    }
  );

  embed.addFields({
    name: 'Game Settings',
    value: `Preferred: **${formatGameName(player.preferred_game || 'valorant')}** | Primary: **${formatGameName(player.primary_game || 'valorant')}** | Mode: **${player.role_mode || 'highest'}**`,
    inline: false,
  });

  // Add progression info if not at max rank
  if (progression.nextRank) {
    const progressBar = createProgressBar(progression.progressToNext);
    
    embed.addFields(
      {
        name: 'Progress to Next Rank',
        value: `${progressBar} **${progression.progressToNext}%**`,
        inline: false,
      },
      {
        name: 'Next Rank',
        value: `**${progression.nextRank}** (${progression.nextRankMMR} MMR)`,
        inline: true,
      },
      {
        name: 'MMR Needed',
        value: `**${progression.mmrNeeded}** MMR`,
        inline: true,
      }
    );
  } else {
    embed.addFields({
      name: 'Status',
      value: '🏆 **Maximum Rank Achieved!**',
      inline: false,
    });
  }

  // Add peak MMR if different
  if (gamePeak > progression.currentMMR) {
    embed.addFields({
      name: 'Peak MMR',
      value: `**${gamePeak}** MMR`,
      inline: true,
    });
  }

  // Add verification info if linked
  if (player.riot_name && player.riot_tag) {
    embed.setFooter({
      text: `Linked: ${player.riot_name}#${player.riot_tag} | Region: ${(player.riot_region || 'N/A').toUpperCase()}`,
    });
  }

  const attachments: AttachmentBuilder[] = [];
  const { rankCardService, rankProfileImageService } = services;

  if (rankProfileImageService) {
    try {
      const profileBuffer = await rankProfileImageService.renderProfile({
        playerName: interaction.user.username,
        discordId: interaction.user.id,
        avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
        gameLabel: formatGameName(selectedGame),
        rankName: progression.currentRank,
        rankMMR: progression.currentMMR,
        stats: summaryStats,
        progress: progression.nextRank
          ? {
              percent: progression.progressToNext,
              text: `${progression.currentMMR} / ${progression.nextRankMMR} MMR`,
            }
          : undefined,
        recentGames: matchSummary?.recentGames,
      });
      if (Buffer.isBuffer(profileBuffer)) {
        const attachment = new AttachmentBuilder(profileBuffer, { name: 'rank-profile.png' });
        attachments.push(attachment);
        embed.setImage('attachment://rank-profile.png');
      } else {
        console.warn('Rank profile image buffer invalid', { userId });
      }
    } catch (error) {
      console.warn('Failed to generate rank profile image', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (rankCardService) {
    try {
      const cardBuffer = await rankCardService.createRankCard({
        username: interaction.user.username,
        avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
        game: 'combined',
        discordRank: progression.currentRank,
        discordMMR: progression.currentMMR,
        valorantRank,
        valorantMMR,
        marvelRank,
        marvelMMR,
      });
      if (Buffer.isBuffer(cardBuffer)) {
        const attachment = new AttachmentBuilder(cardBuffer, { name: 'rank-card.png' });
        attachments.push(attachment);
        embed.setImage('attachment://rank-card.png');
      } else {
        console.warn('Rank card buffer invalid', { userId });
      }
    } catch (error) {
      console.warn('Failed to generate rank card image', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await safeEditReply(interaction, { embeds: [embed], files: attachments });
  } catch (error: any) {
    // Handle already acknowledged errors - don't try to reply again
    if (error?.code === 40060) {
      return;
    }

    // Only log if it's not a timeout error (timeout errors are handled silently)
    if (error?.code !== 10062) {
      console.error('Rank command error', {
        userId,
        username,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    // Only try to send error reply if interaction hasn't been handled yet
    if (!interaction.replied) {
      await safeEditReply(interaction, {
        content: '❌ An error occurred while fetching your rank. Please try again later.',
      });
    }
  }
}

/**
 * Get color for rank embed (custom ranks)
 * Follows guardrails: input validation
 */
function getRankColor(rank: string): number {
  if (!rank || typeof rank !== 'string') {
    return 0x5865f2; // Default Discord blue
  }

  const rankLower = rank.toUpperCase();
  
  // Custom rank colors
  const colors: Record<string, number> = {
    'GRNDS I': 0x808080, // Gray
    'GRNDS II': 0x808080,
    'GRNDS III': 0x808080,
    'GRNDS IV': 0x808080,
    'GRNDS V': 0x808080,
    'BREAKPOINT I': 0x4a90e2, // Blue
    'BREAKPOINT II': 0x4a90e2,
    'BREAKPOINT III': 0x4a90e2,
    'BREAKPOINT IV': 0x4a90e2,
    'BREAKPOINT V': 0x4a90e2,
    'CHALLENGER I': 0xff6b6b, // Red
    'CHALLENGER II': 0xff6b6b,
    'CHALLENGER III': 0xff6b6b,
    'ABSOLUTE': 0xffb347, // Orange
    'X': 0xffd700, // Gold
    'UNRANKED': 0x2c2f33, // Dark gray
  };
  
  return colors[rankLower] || 0x5865f2; // Default Discord blue
}

/**
 * Create a progress bar string
 */
function createProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getEmptyMatchStats() {
  return {
    wins: 0,
    losses: 0,
    winrate: '0%',
    kills: 0,
    deaths: 0,
    kd: '0.00',
    mvp: 0,
    svp: 0,
    games: 0,
  };
}
