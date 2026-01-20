import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  AttachmentBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { RankCalculationService } from '../services/RankCalculationService';
import { RankCardService } from '../services/RankCardService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('View your Discord rank, MMR, and progression');

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

    // Get rank progression
    const progression = await rankCalculationService.getRankProgression(userId);

    if (!progression) {
      await safeEditReply(interaction, {
        content: '❌ Could not fetch rank information.',
      });
      return;
    }

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

  const valorantRank = player.valorant_rank || player.discord_rank || 'Unranked';
  const valorantMMR = player.valorant_mmr || player.current_mmr || 0;
  const marvelRank = player.marvel_rivals_rank || 'Unranked';
  const marvelMMR = player.marvel_rivals_mmr || 0;

  embed.addFields(
    {
      name: 'Valorant',
      value: `**${valorantRank}** (${valorantMMR} MMR)`,
      inline: true,
    },
    {
      name: 'Marvel Rivals',
      value: `**${marvelRank}** (${marvelMMR} MMR)`,
      inline: true,
    }
  );

  embed.addFields({
    name: 'Game Settings',
    value: `Preferred: **${(player.preferred_game || 'valorant').replace('_', ' ')}** | Primary: **${(player.primary_game || 'valorant').replace('_', ' ')}** | Mode: **${player.role_mode || 'highest'}**`,
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
  if (player.peak_mmr > progression.currentMMR) {
    embed.addFields({
      name: 'Peak MMR',
      value: `**${player.peak_mmr}** MMR`,
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
  const { rankCardService } = services;

  if (rankCardService) {
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
      const attachment = new AttachmentBuilder(cardBuffer, { name: 'rank-card.png' });
      attachments.push(attachment);
      embed.setImage('attachment://rank-card.png');
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
    'CHALLENGER IV': 0xff6b6b,
    'CHALLENGER V': 0xff6b6b,
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
