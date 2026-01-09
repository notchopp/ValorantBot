import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';

export const data = new SlashCommandBuilder()
  .setName('streak')
  .setDescription('View your current win/loss streak and MMR impact');

interface MatchResult {
  won: boolean;
  mmrChange: number;
  matchDate: string;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { databaseService } = services;

    // Get player data
    const player = await databaseService.getPlayer(userId);
    if (!player) {
      await interaction.editReply(
        '❌ You are not verified. Use `/verify` to link your Riot ID and get placed.'
      );
      return;
    }

    // Get match history (last 50 matches for streak calculation)
    const matchHistory = await getPlayerMatchHistory(databaseService, player.id, 50);

    if (!matchHistory || matchHistory.length === 0) {
      await interaction.editReply(
        '❌ No match history found. Play some games to track your streaks!'
      );
      return;
    }

    // Calculate current streak
    const streakInfo = calculateStreak(matchHistory);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${streakInfo.emoji} ${interaction.user.username}'s Streak`)
      .setColor(streakInfo.color)
      .setThumbnail(interaction.user.displayAvatarURL());

    // Add current streak
    embed.addFields({
      name: 'Current Streak',
      value: `**${streakInfo.streakText}** (${streakInfo.count} ${streakInfo.count === 1 ? 'game' : 'games'})`,
      inline: false,
    });

    // Add MMR impact
    if (streakInfo.mmrImpact !== 0) {
      const mmrSign = streakInfo.mmrImpact > 0 ? '+' : '';
      embed.addFields({
        name: 'MMR Impact During Streak',
        value: `**${mmrSign}${streakInfo.mmrImpact}** MMR`,
        inline: true,
      });
    }

    // Add average MMR change per game in streak
    if (streakInfo.count > 0) {
      const avgMMR = Math.round(streakInfo.mmrImpact / streakInfo.count);
      const avgSign = avgMMR > 0 ? '+' : '';
      embed.addFields({
        name: 'Avg Per Game',
        value: `**${avgSign}${avgMMR}** MMR`,
        inline: true,
      });
    }

    // Add current MMR
    embed.addFields({
      name: 'Current MMR',
      value: `**${player.current_mmr}**`,
      inline: true,
    });

    // Calculate best streak (wins)
    const bestWinStreak = findBestStreak(matchHistory, true);
    if (bestWinStreak.count > 1) {
      embed.addFields({
        name: '🔥 Best Win Streak',
        value: `**${bestWinStreak.count}** wins (${bestWinStreak.mmrGain > 0 ? '+' : ''}${bestWinStreak.mmrGain} MMR)`,
        inline: true,
      });
    }

    // Calculate worst streak (losses)
    const worstLossStreak = findBestStreak(matchHistory, false);
    if (worstLossStreak.count > 1) {
      embed.addFields({
        name: '❄️ Worst Loss Streak',
        value: `**${worstLossStreak.count}** losses (${worstLossStreak.mmrGain} MMR)`,
        inline: true,
      });
    }

    // Add form guide (last 5 games)
    const formGuide = matchHistory.slice(0, 5).map(m => m.won ? 'W' : 'L').join(' ');
    embed.addFields({
      name: 'Last 5 Games',
      value: formGuide,
      inline: true,
    });

    // Add motivational footer based on streak
    if (streakInfo.type === 'win') {
      embed.setFooter({
        text: `Keep it going! ${streakInfo.count >= 3 ? '🔥 On fire!' : ''}`,
      });
    } else if (streakInfo.type === 'loss') {
      embed.setFooter({
        text: `Don't give up! Every streak ends eventually.`,
      });
    } else {
      embed.setFooter({
        text: 'Start a new streak!',
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Streak command error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while fetching your streak. Please try again later.',
    });
  }
}

/**
 * Get player match history with results
 */
async function getPlayerMatchHistory(
  databaseService: DatabaseService,
  playerId: string,
  limit: number
): Promise<MatchResult[]> {
  try {
    const supabase = databaseService.supabase;
    if (!supabase) {
      console.error('Supabase not initialized');
      return [];
    }

    // Get match player stats ordered by match date (most recent first)
    const { data, error } = await supabase
      .from('match_player_stats')
      .select(`
        mmr_before,
        mmr_after,
        team,
        match_id,
        matches!inner(
          match_date,
          winner,
          status
        )
      `)
      .eq('player_id', playerId)
      .eq('matches.status', 'completed')
      .order('matches(match_date)', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('Error getting match history', { playerId, error });
      return [];
    }

    // Convert to MatchResult format
    const results: MatchResult[] = data.map((stat: any) => {
      const won = stat.matches.winner === stat.team;
      const mmrChange = stat.mmr_after - stat.mmr_before;
      return {
        won,
        mmrChange,
        matchDate: stat.matches.match_date,
      };
    });

    return results;
  } catch (error) {
    console.error('Error getting player match history', {
      playerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Calculate current streak
 */
function calculateStreak(matchHistory: MatchResult[]): {
  type: 'win' | 'loss' | 'none';
  count: number;
  mmrImpact: number;
  streakText: string;
  emoji: string;
  color: number;
} {
  if (matchHistory.length === 0) {
    return {
      type: 'none',
      count: 0,
      mmrImpact: 0,
      streakText: 'No streak',
      emoji: '📊',
      color: 0x5865f2,
    };
  }

  const firstResult = matchHistory[0].won;
  let count = 0;
  let mmrImpact = 0;

  for (const match of matchHistory) {
    if (match.won === firstResult) {
      count++;
      mmrImpact += match.mmrChange;
    } else {
      break;
    }
  }

  const type = firstResult ? 'win' : 'loss';
  const emoji = type === 'win' ? (count >= 3 ? '🔥' : '✅') : (count >= 3 ? '❄️' : '❌');
  const streakText = type === 'win' ? `${count} Win Streak` : `${count} Loss Streak`;
  const color = type === 'win' ? 0x00ff00 : 0xff0000;

  return {
    type,
    count,
    mmrImpact,
    streakText,
    emoji,
    color,
  };
}

/**
 * Find best streak (longest win streak or longest loss streak)
 */
function findBestStreak(matchHistory: MatchResult[], findWins: boolean): {
  count: number;
  mmrGain: number;
} {
  let maxCount = 0;
  let maxMMR = 0;
  let currentCount = 0;
  let currentMMR = 0;

  for (const match of matchHistory) {
    if (match.won === findWins) {
      currentCount++;
      currentMMR += match.mmrChange;

      if (currentCount > maxCount) {
        maxCount = currentCount;
        maxMMR = currentMMR;
      }
    } else {
      currentCount = 0;
      currentMMR = 0;
    }
  }

  return {
    count: maxCount,
    mmrGain: maxMMR,
  };
}
