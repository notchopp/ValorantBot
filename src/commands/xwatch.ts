import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';

export const data = new SlashCommandBuilder()
  .setName('xwatch')
  .setDescription('Track the Top 10 X rank players and their movement');

interface XRankPlayer {
  rank: number;
  discordUserId: string;
  discordUsername: string;
  mmr: number;
  peakMMR: number;
  wins: number;
  losses: number;
  winRate: number;
  recentMMRChange: number; // Last 24 hours
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
  }
) {
  await interaction.deferReply();

  try {
    const { databaseService } = services;

    // Get top 10 players (X rank threshold is 3000+ MMR)
    const xRankPlayers = await getXRankPlayers(databaseService);

    if (!xRankPlayers || xRankPlayers.length === 0) {
      await interaction.editReply(
        '🏆 No players have reached X rank yet! Be the first to hit 3000 MMR!'
      );
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('👑 X Rank - Top 10 Leaderboard')
      .setColor(0xffd700) // Gold
      .setDescription('The elite. The best. The X rank players.')
      .setTimestamp();

    // Add players to embed
    for (let i = 0; i < xRankPlayers.length; i++) {
      const player = xRankPlayers[i];
      const medal = i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      
      // Trend indicator
      let trendEmoji = '➡️';
      if (player.recentMMRChange > 20) trendEmoji = '📈';
      else if (player.recentMMRChange > 50) trendEmoji = '🚀';
      else if (player.recentMMRChange < -20) trendEmoji = '📉';
      else if (player.recentMMRChange < -50) trendEmoji = '⚠️';

      const mmrChangeText = player.recentMMRChange !== 0 
        ? ` ${trendEmoji} ${player.recentMMRChange > 0 ? '+' : ''}${player.recentMMRChange} (24h)`
        : '';

      embed.addFields({
        name: `${medal} ${player.discordUsername}`,
        value: 
          `**${player.mmr}** MMR${mmrChangeText}\n` +
          `Peak: ${player.peakMMR} | ${player.wins}W-${player.losses}L (${player.winRate}%)`,
        inline: false,
      });
    }

    // Add threshold info
    const minXRankMMR = xRankPlayers[xRankPlayers.length - 1]?.mmr || 3000;
    embed.setFooter({
      text: `X Rank Requirement: 3000+ MMR | Current #10: ${minXRankMMR} MMR`,
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('XWatch command error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while fetching X rank players. Please try again later.',
    });
  }
}

/**
 * Get X rank players (top 10 by MMR, minimum 3000 MMR)
 */
async function getXRankPlayers(
  databaseService: DatabaseService
): Promise<XRankPlayer[]> {
  try {
    const supabase = databaseService.supabase;
    const X_RANK_THRESHOLD = 3000;

    // Get top players by MMR
    const { data: topPlayers, error } = await supabase
      .from('players')
      .select('id, discord_user_id, discord_username, current_mmr, peak_mmr')
      .gte('current_mmr', X_RANK_THRESHOLD)
      .order('current_mmr', { ascending: false })
      .limit(10);

    if (error || !topPlayers || topPlayers.length === 0) {
      return [];
    }

    // Get stats and recent MMR changes for each player
    const xRankPlayers: XRankPlayer[] = [];

    for (let i = 0; i < topPlayers.length; i++) {
      const player = topPlayers[i];

      // Get win/loss stats
      const { data: statsData } = await supabase
        .from('match_player_stats')
        .select(`
          matches!inner(
            winner,
            status
          ),
          team
        `)
        .eq('player_id', player.id)
        .eq('matches.status', 'completed');

      let wins = 0;
      let losses = 0;

      if (statsData) {
        for (const stat of statsData) {
          if (stat.matches.winner === stat.team) {
            wins++;
          } else {
            losses++;
          }
        }
      }

      const totalGames = wins + losses;
      const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';

      // Get recent MMR change (last 24 hours)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: recentMatches } = await supabase
        .from('match_player_stats')
        .select(`
          mmr_before,
          mmr_after,
          matches!inner(
            match_date,
            status
          )
        `)
        .eq('player_id', player.id)
        .eq('matches.status', 'completed')
        .gte('matches.match_date', twentyFourHoursAgo.toISOString())
        .order('matches(match_date)', { ascending: true });

      let recentMMRChange = 0;
      if (recentMatches && recentMatches.length > 0) {
        const firstMatch = recentMatches[0];
        const lastMatch = recentMatches[recentMatches.length - 1];
        recentMMRChange = lastMatch.mmr_after - firstMatch.mmr_before;
      }

      xRankPlayers.push({
        rank: i + 1,
        discordUserId: player.discord_user_id,
        discordUsername: player.discord_username,
        mmr: player.current_mmr || 0,
        peakMMR: player.peak_mmr || 0,
        wins,
        losses,
        winRate: parseFloat(winRate),
        recentMMRChange,
      });
    }

    return xRankPlayers;
  } catch (error) {
    console.error('Error getting X rank players', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
