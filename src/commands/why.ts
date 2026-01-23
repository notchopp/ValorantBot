import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { GAME_CHOICES, MODE_CHOICES, normalizeModeSelection, resolveGameForPlayer, formatGameName, formatModeName, getMatchTypesForMode } from '../utils/game-selection';

export const data = new SlashCommandBuilder()
  .setName('why')
  .setDescription('Get AI-powered analysis of why you might be losing or stuck at your rank')
  .addStringOption((option) =>
    option
      .setName('mode')
      .setDescription('Analyze custom or ranked matches')
      .addChoices(...MODE_CHOICES)
      .setRequired(true)
  )
  .addStringOption((option) =>
    option.setName('game').setDescription('Which game to analyze').addChoices(...GAME_CHOICES)
  );

interface PerformanceAnalysis {
  recentWinRate: number;
  averageKD: number;
  averageMMRChange: number;
  matchesAnalyzed: number;
  consistencyScore: number; // 0-100
  trendDirection: 'improving' | 'declining' | 'stable';
}

// Rate limiting: 3 uses per day per user
const usageTracker = new Map<string, { count: number; resetTime: number }>();
const DAILY_LIMIT = 3;

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const userUsage = usageTracker.get(userId);

  // Reset if it's a new day (24 hours since last reset)
  if (!userUsage || now >= userUsage.resetTime) {
    const resetTime = now + 24 * 60 * 60 * 1000; // 24 hours from now
    usageTracker.set(userId, { count: 0, resetTime });
    return { allowed: true, remaining: DAILY_LIMIT, resetTime };
  }

  // Check if user has exceeded limit
  if (userUsage.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0, resetTime: userUsage.resetTime };
  }

  return { allowed: true, remaining: DAILY_LIMIT - userUsage.count, resetTime: userUsage.resetTime };
}

function incrementUsage(userId: string): void {
  const userUsage = usageTracker.get(userId);
  if (userUsage) {
    userUsage.count++;
  }
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

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      const hoursUntilReset = Math.ceil((rateLimit.resetTime - Date.now()) / (1000 * 60 * 60));
      await interaction.editReply(
        `⏰ You've used your daily limit of ${DAILY_LIMIT} analyses. ` +
        `This limit resets in approximately ${hoursUntilReset} hour${hoursUntilReset !== 1 ? 's' : ''}. ` +
        `We plan to increase usage limits in the future based on demand!`
      );
      return;
    }

    // Get player data
    const player = await databaseService.getPlayer(userId);
    if (!player) {
      await interaction.editReply(
        '❌ You are not verified. Use `/verify` to link your Riot ID and get placed.'
      );
      return;
    }

    const selectedGame = resolveGameForPlayer(player, interaction.options.getString('game'));
    const selectedMode = normalizeModeSelection(interaction.options.getString('mode'));
    // Check if player has enough games by counting matches
    const supabaseCheck = databaseService.supabase;
    if (!supabaseCheck) {
      await interaction.editReply('❌ Database not available. Please try again later.');
      return;
    }
    
    const { count: matchCount } = await supabaseCheck
      .from('match_player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('player_id', player.id)
      .in('matches.match_type', getMatchTypesForMode(selectedGame, selectedMode));
    
    if (!matchCount || matchCount < 5) {
      await interaction.editReply(
        '❌ You need to play at least 5 games before I can analyze your performance. Queue up and come back!'
      );
      return;
    }

    // Get recent match data for analysis
    const analysis = await analyzePerformance(databaseService, player.id, userId, selectedGame, selectedMode);

    if (!analysis) {
      await interaction.editReply(
        '❌ Unable to analyze your performance right now. Try again later.'
      );
      return;
    }

    // Generate insights based on analysis
    const insights = generateInsights(analysis, player);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`🧠 ${formatGameName(selectedGame)} ${formatModeName(selectedMode)} Analysis for ${interaction.user.username}`)
      .setColor(getAnalysisColor(analysis))
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(insights.summary);

    // Add key metrics
    embed.addFields(
      {
        name: '📊 Recent Performance (Last 20 Games)',
        value: 
          `**Win Rate:** ${analysis.recentWinRate}%\n` +
          `**Avg K/D:** ${analysis.averageKD}\n` +
          `**Avg MMR Change:** ${analysis.averageMMRChange > 0 ? '+' : ''}${analysis.averageMMRChange}`,
        inline: false,
      },
      {
        name: '📈 Trend Analysis',
        value: `**Direction:** ${getTrendEmoji(analysis.trendDirection)} ${analysis.trendDirection.toUpperCase()}\n` +
              `**Consistency:** ${analysis.consistencyScore}/100`,
        inline: false,
      }
    );

    // Add primary issue
    if (insights.primaryIssue) {
      embed.addFields({
        name: '🎯 Primary Issue',
        value: insights.primaryIssue,
        inline: false,
      });
    }

    // Add recommendations
    if (insights.recommendations.length > 0) {
      embed.addFields({
        name: '💡 Recommendations',
        value: insights.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n'),
        inline: false,
      });
    }

    // Add positive notes if improving
    if (analysis.trendDirection === 'improving') {
      embed.addFields({
        name: '✅ What You\'re Doing Right',
        value: insights.positiveNotes || 'Keep up the momentum!',
        inline: false,
      });
    }

    // Increment usage counter after successful analysis
    incrementUsage(userId);

    // Add usage info to footer
    const remainingUses = rateLimit.remaining - 1;
    embed.setFooter({
      text: `Analysis based on ${analysis.matchesAnalyzed} recent matches | ${remainingUses} use${remainingUses !== 1 ? 's' : ''} remaining today`,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Why command error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while analyzing your performance. Please try again later.',
    });
  }
}

/**
 * Analyze player's recent performance
 */
async function analyzePerformance(
  databaseService: DatabaseService,
  playerId: string,
  _userId: string,
  game: 'valorant' | 'marvel_rivals',
  mode: 'custom' | 'ranked'
): Promise<PerformanceAnalysis | null> {
  try {
    const supabase = databaseService.supabase;
    if (!supabase) {
      console.error('Supabase not initialized');
      return null;
    }

    // Get last 20 matches
    const matchTypes = getMatchTypesForMode(game, mode);
    const { data: matches, error } = await supabase
      .from('match_player_stats')
      .select(`
        mmr_before,
        mmr_after,
        kills,
        deaths,
        assists,
        team,
        matches!inner(
          winner,
          status,
          match_date
        )
      `)
      .eq('player_id', playerId)
      .eq('matches.status', 'completed')
      .in('matches.match_type', matchTypes)
      .order('matches(match_date)', { ascending: false })
      .limit(20);

    if (error || !matches || matches.length === 0) {
      return null;
    }

    // Calculate metrics
    let wins = 0;
    let totalKD = 0;
    let totalMMRChange = 0;
    let mmrChanges: number[] = [];

    for (const match of matches) {
      const matchData = match.matches as any;
      const won = matchData?.winner === match.team;
      if (won) wins++;

      const kd = match.deaths > 0 ? match.kills / match.deaths : match.kills;
      totalKD += kd;

      const mmrChange = match.mmr_after - match.mmr_before;
      totalMMRChange += mmrChange;
      mmrChanges.push(mmrChange);
    }

    const recentWinRate = parseFloat(((wins / matches.length) * 100).toFixed(1));
    const averageKD = parseFloat((totalKD / matches.length).toFixed(2));
    const averageMMRChange = Math.round(totalMMRChange / matches.length);

    // Calculate consistency (lower variance = higher consistency)
    const avgMMR = totalMMRChange / matches.length;
    const variance = mmrChanges.reduce((sum, change) => sum + Math.pow(change - avgMMR, 2), 0) / matches.length;
    const stdDev = Math.sqrt(variance);
    const consistencyScore = Math.max(0, Math.min(100, 100 - (stdDev / 2)));

    // Determine trend (compare first half vs second half)
    const firstHalfMMR = mmrChanges.slice(0, Math.floor(matches.length / 2)).reduce((a, b) => a + b, 0);
    const secondHalfMMR = mmrChanges.slice(Math.floor(matches.length / 2)).reduce((a, b) => a + b, 0);
    
    let trendDirection: 'improving' | 'declining' | 'stable';
    if (secondHalfMMR - firstHalfMMR > 30) {
      trendDirection = 'improving';
    } else if (firstHalfMMR - secondHalfMMR > 30) {
      trendDirection = 'declining';
    } else {
      trendDirection = 'stable';
    }

    return {
      recentWinRate,
      averageKD,
      averageMMRChange,
      matchesAnalyzed: matches.length,
      consistencyScore: Math.round(consistencyScore),
      trendDirection,
    };
  } catch (error) {
    console.error('Error analyzing performance', {
      playerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Generate insights based on analysis
 */
function generateInsights(
  analysis: PerformanceAnalysis,
  _player: any
): {
  summary: string;
  primaryIssue: string | null;
  recommendations: string[];
  positiveNotes: string | null;
} {
  const recommendations: string[] = [];
  let primaryIssue: string | null = null;
  let positiveNotes: string | null = null;
  let summary = '';

  // Generate summary
  if (analysis.trendDirection === 'improving') {
    summary = `You're on an upward trajectory! Your recent performance shows improvement, keep pushing.`;
    positiveNotes = `Your consistency is at ${analysis.consistencyScore}/100, and you're averaging ${analysis.averageMMRChange > 0 ? '+' : ''}${analysis.averageMMRChange} MMR per game. Whatever you're doing, keep it up.`;
  } else if (analysis.trendDirection === 'declining') {
    summary = `Your recent performance shows a decline. Let's identify what's holding you back.`;
  } else {
    summary = `You're playing consistently at your current level. Here's how to break through to the next rank.`;
  }

  // Analyze win rate
  if (analysis.recentWinRate < 45) {
    primaryIssue = `Your win rate is ${analysis.recentWinRate}%, which is below the 50% needed to climb. This is your biggest roadblock right now.`;
    recommendations.push('Focus on playing with consistent teammates to improve team coordination');
    recommendations.push('Review your last 5 losses and identify common mistakes');
  } else if (analysis.recentWinRate > 55) {
    if (analysis.trendDirection !== 'improving') {
      recommendations.push('Your win rate is solid, keep this momentum going');
    }
  }

  // Analyze K/D
  if (analysis.averageKD < 0.8) {
    if (!primaryIssue) {
      primaryIssue = `Your K/D ratio is ${analysis.averageKD}, indicating you're dying too much without trading kills effectively.`;
    }
    recommendations.push('Work on positioning and staying alive longer, deaths hurt your team and MMR');
    recommendations.push('Play more conservatively, focus on not feeding rather than getting kills');
  } else if (analysis.averageKD < 1.0) {
    recommendations.push('Your K/D is close to even, focus on getting more impact per death');
  } else if (analysis.averageKD > 1.2) {
    if (analysis.trendDirection !== 'improving' && !primaryIssue) {
      primaryIssue = 'Your individual performance is strong, but your win rate suggests team play or clutch situations might be the issue.';
      recommendations.push('Focus on playing for the team win, not just KDA');
      recommendations.push('Work on closing out rounds and clutch situations');
    }
  }

  // Analyze MMR trend
  if (analysis.averageMMRChange < -5) {
    if (!primaryIssue) {
      primaryIssue = `You're losing an average of ${Math.abs(analysis.averageMMRChange)} MMR per game, indicating consistent losses or poor performance in wins.`;
    }
    recommendations.push('Take a break if you\'re on a loss streak, tilt makes it worse');
    recommendations.push('Queue with higher MMR players to challenge yourself and learn');
  }

  // Analyze consistency
  if (analysis.consistencyScore < 40) {
    recommendations.push('Your performance varies wildly between games, work on playing more consistently');
    recommendations.push('Establish a warmup routine before queuing to perform more reliably');
  }

  // Default primary issue if none identified
  if (!primaryIssue) {
    if (analysis.recentWinRate >= 50 && analysis.averageKD >= 1.0) {
      primaryIssue = 'Your stats look solid overall. You might just need more games to climb, or focus on winning closer matches.';
    } else {
      primaryIssue = 'Your performance is fairly balanced but could use improvement across the board.';
    }
  }

  // Add general recommendations if list is short
  if (recommendations.length < 3) {
    if (analysis.recentWinRate < 50) {
      recommendations.push('Watch VODs of higher ranked players to learn positioning and decision making');
    }
    recommendations.push('Use /streak and /history to track your improvement over time');
  }

  return {
    summary,
    primaryIssue,
    recommendations: recommendations.slice(0, 4), // Limit to 4 recommendations
    positiveNotes,
  };
}

/**
 * Get color based on analysis
 */
function getAnalysisColor(analysis: PerformanceAnalysis): number {
  if (analysis.trendDirection === 'improving') {
    return 0x00ff00; // Green
  } else if (analysis.trendDirection === 'declining') {
    return 0xff6b6b; // Red
  } else {
    return 0x5865f2; // Blue
  }
}

/**
 * Get trend emoji
 */
function getTrendEmoji(trend: 'improving' | 'declining' | 'stable'): string {
  switch (trend) {
    case 'improving':
      return '📈';
    case 'declining':
      return '📉';
    case 'stable':
      return '➡️';
  }
}
