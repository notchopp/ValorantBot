import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { RankCalculationService } from '../services/RankCalculationService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';
import { GAME_CHOICES, getGameRankFields, resolveGameForPlayer, formatGameName } from '../utils/game-selection';

export const data = new SlashCommandBuilder()
  .setName('progress')
  .setDescription('View your detailed rank progression and MMR trends')
  .addStringOption((option) =>
    option.setName('game').setDescription('Choose which game to view').addChoices(...GAME_CHOICES)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    rankCalculationService: RankCalculationService;
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
        content: '❌ You are not verified. Use `/verify` to link your Riot ID and get placed.',
      });
      return;
    }
    const selectedGame = resolveGameForPlayer(player, interaction.options.getString('game'));

    const { rank: gameRank, mmr: gameMMR, peak: gamePeak } = getGameRankFields(player, selectedGame);

    // Check if player has rank for selected game
    if (!gameRank || gameRank === 'Unranked') {
      await safeEditReply(interaction, {
        content: '❌ You need to be ranked first. Use `/verify` to get your initial rank placement.',
      });
      return;
    }

    // Get rank progression
    const progression = await rankCalculationService.getRankProgression(userId, selectedGame);
    if (!progression) {
      await safeEditReply(interaction, {
        content: '❌ Could not fetch rank progression.',
      });
      return;
    }

    // Get recent rank history for trend
    const rankHistory = await databaseService.getRankHistory(userId, 5);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${interaction.user.username}'s ${formatGameName(selectedGame)} Progression`)
      .setColor(getRankColor(progression.currentRank))
      .setThumbnail(interaction.user.displayAvatarURL())
      .addFields(
        {
          name: 'Current Rank',
          value: `**${progression.currentRank}**`,
          inline: true,
        },
        {
          name: `${formatGameName(selectedGame)} Rank`,
          value: `**${gameRank}**`,
          inline: true,
        },
        {
          name: `${formatGameName(selectedGame)} MMR`,
          value: `**${gameMMR}**`,
          inline: true,
        },
        {
          name: `${formatGameName(selectedGame)} Peak`,
          value: `**${gamePeak}**`,
          inline: true,
        }
      );

    // Add progression info if not at max rank
    if (progression.nextRank) {
      const progressBar = createProgressBar(progression.progressToNext, 15);
      
      embed.addFields(
        {
          name: 'Progress to Next Rank',
          value: `${progressBar} **${progression.progressToNext}%**`,
          inline: false,
        },
        {
          name: 'Next Rank',
          value: `**${progression.nextRank}**`,
          inline: true,
        },
        {
          name: 'MMR Required',
          value: `**${progression.nextRankMMR}**`,
          inline: true,
        },
        {
          name: 'MMR Needed',
          value: `**+${progression.mmrNeeded}** more`,
          inline: true,
        }
      );

      // Add estimated games needed (assuming ~25 MMR per win)
      const avgMMRPerWin = 25;
      const gamesNeeded = Math.ceil(progression.mmrNeeded / avgMMRPerWin);
      embed.addFields({
        name: '🎯 Estimated Games',
        value: `~**${gamesNeeded}** wins to rank up`,
        inline: false,
      });
    } else {
      embed.addFields({
        name: 'Status',
        value: '🏆 **Maximum Rank Achieved!**',
        inline: false,
      });
    }

    // Add MMR trend if we have history
    if (rankHistory && rankHistory.length > 1) {
      const recentMMRChange = progression.currentMMR - rankHistory[rankHistory.length - 1].old_mmr;
      const trendEmoji = recentMMRChange > 0 ? '📈' : recentMMRChange < 0 ? '📉' : '➡️';
      const trendText = recentMMRChange > 0 ? `+${recentMMRChange}` : recentMMRChange.toString();
      
      embed.addFields({
        name: `${trendEmoji} Recent Trend`,
        value: `**${trendText}** MMR in last ${rankHistory.length} rank changes`,
        inline: false,
      });
    }

    // Add footer with verification info
    if (player.riot_name && player.riot_tag) {
      embed.setFooter({
        text: `${player.riot_name}#${player.riot_tag} | Use /streak for win/loss streaks`,
      });
    } else {
      embed.setFooter({
        text: 'Use /streak for win/loss streaks | Use /history for match history',
      });
    }

    await safeEditReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    // Handle already acknowledged errors - don't try to reply again
    if (error?.code === 40060) {
      // Interaction was already acknowledged, likely by the main error handler
      return;
    }

    // Only log if it's not a timeout error (timeout errors are handled silently)
    if (error?.code !== 10062) {
      console.error('Progress command error', {
        userId,
        username,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    // Only try to send error reply if interaction hasn't been handled yet
    if (!interaction.replied) {
      await safeEditReply(interaction, {
        content: '❌ An error occurred while fetching your progression. Please try again later.',
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

  const rankUpper = rank.toUpperCase();
  
  // Custom rank colors
  const colors: Record<string, number> = {
    'GRNDS I': 0x808080,
    'GRNDS II': 0x808080,
    'GRNDS III': 0x808080,
    'GRNDS IV': 0x808080,
    'GRNDS V': 0x808080,
    'BREAKPOINT I': 0x4a90e2,
    'BREAKPOINT II': 0x4a90e2,
    'BREAKPOINT III': 0x4a90e2,
    'BREAKPOINT IV': 0x4a90e2,
    'BREAKPOINT V': 0x4a90e2,
    'CHALLENGER I': 0xff6b6b,
    'CHALLENGER II': 0xff6b6b,
    'CHALLENGER III': 0xff6b6b,
    'ABSOLUTE': 0xffb347,
    'X': 0xffd700,
    'UNRANKED': 0x2c2f33,
  };
  
  return colors[rankUpper] || 0x5865f2;
}

/**
 * Create a progress bar string
 */
function createProgressBar(percentage: number, length: number = 10): string {
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
