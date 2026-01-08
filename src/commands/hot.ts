import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';

export const data = new SlashCommandBuilder()
  .setName('hot')
  .setDescription('View players with the biggest MMR gains recently');

interface HotPlayer {
  discordUserId: string;
  discordUsername: string;
  rank: string;
  currentMMR: number;
  mmrGain: number;
  matchesPlayed: number;
  winRate: number;
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

    // Get hot players (last 7 days)
    const hotPlayers = await getHotPlayers(databaseService, 10);

    if (!hotPlayers || hotPlayers.length === 0) {
      await interaction.editReply(
        '❌ No active players found in the last 7 days.'
      );
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('🔥 Hot Players - Biggest MMR Gains')
      .setColor(0xff6b6b)
      .setDescription('Top performers in the last 7 days')
      .setTimestamp();

    // Add players to embed
    for (let i = 0; i < hotPlayers.length; i++) {
      const player = hotPlayers[i];
      const rank = i + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const trend = player.mmrGain > 100 ? '🚀' : player.mmrGain > 50 ? '📈' : '⬆️';
      
      embed.addFields({
        name: `${medal} ${player.discordUsername}`,
        value: 
          `${trend} **+${player.mmrGain}** MMR gain | ${player.rank} (${player.currentMMR} MMR)\n` +
          `${player.matchesPlayed} games | ${player.winRate}% WR`,
        inline: false,
      });
    }

    embed.setFooter({
      text: 'Based on last 7 days of activity | Keep grinding to make the list!',
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Hot command error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while fetching hot players. Please try again later.',
    });
  }
}

/**
 * Get hot players (biggest MMR gains in last 7 days)
 */
async function getHotPlayers(
  databaseService: DatabaseService,
  limit: number
): Promise<HotPlayer[]> {
  try {
    const supabase = databaseService.supabase;

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all match player stats from last 7 days
    const { data: recentMatches, error } = await supabase
      .from('match_player_stats')
      .select(`
        player_id,
        mmr_before,
        mmr_after,
        matches!inner(
          winner,
          status,
          match_date,
          team_a,
          team_b
        )
      `)
      .eq('matches.status', 'completed')
      .gte('matches.match_date', sevenDaysAgo.toISOString());

    if (error || !recentMatches) {
      console.error('Error getting recent matches', { error });
      return [];
    }

    // Group by player and calculate MMR gains
    const playerStats = new Map<string, {
      mmrGain: number;
      matchCount: number;
      wins: number;
      startMMR: number;
      endMMR: number;
    }>();

    for (const match of recentMatches) {
      const playerId = match.player_id;
      const mmrChange = match.mmr_after - match.mmr_before;
      
      if (!playerStats.has(playerId)) {
        playerStats.set(playerId, {
          mmrGain: 0,
          matchCount: 0,
          wins: 0,
          startMMR: match.mmr_before,
          endMMR: match.mmr_after,
        });
      }

      const stats = playerStats.get(playerId)!;
      stats.mmrGain += mmrChange;
      stats.matchCount++;
      stats.endMMR = match.mmr_after; // Update to latest
      
      // Check if won (assuming team_a and team_b are JSON)
      // This is a simplified check - in production you'd need to parse the team arrays
      if (mmrChange > 0) {
        stats.wins++;
      }
    }

    // Get player details for top gainers
    const sortedPlayers = Array.from(playerStats.entries())
      .filter(([_, stats]) => stats.matchCount >= 3) // Must have played at least 3 games
      .sort((a, b) => b[1].mmrGain - a[1].mmrGain)
      .slice(0, limit);

    const hotPlayers: HotPlayer[] = [];

    for (const [playerId, stats] of sortedPlayers) {
      // Get player details
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('discord_user_id, discord_username, discord_rank, current_mmr')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        continue;
      }

      const winRate = ((stats.wins / stats.matchCount) * 100).toFixed(0);

      hotPlayers.push({
        discordUserId: player.discord_user_id,
        discordUsername: player.discord_username,
        rank: player.discord_rank || 'Unranked',
        currentMMR: player.current_mmr || 0,
        mmrGain: stats.mmrGain,
        matchesPlayed: stats.matchCount,
        winRate: parseFloat(winRate),
      });
    }

    return hotPlayers;
  } catch (error) {
    console.error('Error getting hot players', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
