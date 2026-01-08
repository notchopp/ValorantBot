import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  User,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { getKD, getWinRate } from '../models/Player';

export const data = new SlashCommandBuilder()
  .setName('compare')
  .setDescription('Compare stats with another player')
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('Player to compare with')
      .setRequired(true)
  );

interface PlayerComparisonStats {
  userId: string;
  username: string;
  rank: string;
  mmr: number;
  peakMMR: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  mvps: number;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
  }
) {
  await interaction.deferReply();

  const user1 = interaction.user;
  const user2 = interaction.options.getUser('user', true);

  // Prevent comparing with yourself
  if (user1.id === user2.id) {
    await interaction.editReply('❌ You cannot compare with yourself! Try comparing with someone else.');
    return;
  }

  try {
    const { databaseService } = services;

    // Get both players' data
    const [player1Data, player2Data] = await Promise.all([
      getPlayerComparisonData(databaseService, user1),
      getPlayerComparisonData(databaseService, user2),
    ]);

    if (!player1Data) {
      await interaction.editReply(
        `❌ ${user1.username} is not verified. Use \`/verify\` to get started.`
      );
      return;
    }

    if (!player2Data) {
      await interaction.editReply(
        `❌ ${user2.username} is not verified or has no stats yet.`
      );
      return;
    }

    // Create comparison embed
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Player Comparison')
      .setColor(0x5865f2)
      .setDescription(`${user1.username} vs ${user2.username}`);

    // Rank & MMR
    const higherMMR = player1Data.mmr > player2Data.mmr ? player1Data : player2Data;
    embed.addFields({
      name: '🏆 Rank & MMR',
      value: 
        `**${user1.username}:** ${player1Data.rank} (${player1Data.mmr} MMR)\n` +
        `**${user2.username}:** ${player2Data.rank} (${player2Data.mmr} MMR)\n` +
        `**Leader:** ${higherMMR.username} (+${Math.abs(player1Data.mmr - player2Data.mmr)} MMR)`,
      inline: false,
    });

    // Games & Win Rate
    const higherWR = player1Data.winRate > player2Data.winRate ? player1Data : player2Data;
    embed.addFields({
      name: '📊 Games & Win Rate',
      value:
        `**${user1.username}:** ${player1Data.wins}W-${player1Data.losses}L (${player1Data.winRate}%)\n` +
        `**${user2.username}:** ${player2Data.wins}W-${player2Data.losses}L (${player2Data.winRate}%)\n` +
        `**Leader:** ${higherWR.username} (${higherWR.winRate}% WR)`,
      inline: false,
    });

    // K/D Ratio
    const higherKD = player1Data.kd > player2Data.kd ? player1Data : player2Data;
    embed.addFields({
      name: '🎯 K/D Ratio',
      value:
        `**${user1.username}:** ${player1Data.kd} K/D (${player1Data.kills}/${player1Data.deaths}/${player1Data.assists})\n` +
        `**${user2.username}:** ${player2Data.kd} K/D (${player2Data.kills}/${player2Data.deaths}/${player2Data.assists})\n` +
        `**Leader:** ${higherKD.username} (${higherKD.kd} K/D)`,
      inline: false,
    });

    // MVPs
    const higherMVPs = player1Data.mvps > player2Data.mvps ? player1Data : player2Data;
    embed.addFields({
      name: '👑 MVPs',
      value:
        `**${user1.username}:** ${player1Data.mvps} MVPs\n` +
        `**${user2.username}:** ${player2Data.mvps} MVPs\n` +
        `**Leader:** ${higherMVPs.username} (${higherMVPs.mvps} MVPs)`,
      inline: false,
    });

    // Peak MMR
    const higherPeak = player1Data.peakMMR > player2Data.peakMMR ? player1Data : player2Data;
    embed.addFields({
      name: '🔝 Peak MMR',
      value:
        `**${user1.username}:** ${player1Data.peakMMR} MMR\n` +
        `**${user2.username}:** ${player2Data.peakMMR} MMR\n` +
        `**Highest:** ${higherPeak.username} (${higherPeak.peakMMR} MMR)`,
      inline: false,
    });

    // Overall winner
    let score1 = 0;
    let score2 = 0;
    if (player1Data.mmr > player2Data.mmr) score1++;
    else score2++;
    if (player1Data.winRate > player2Data.winRate) score1++;
    else score2++;
    if (player1Data.kd > player2Data.kd) score1++;
    else score2++;
    if (player1Data.mvps > player2Data.mvps) score1++;
    else score2++;
    if (player1Data.peakMMR > player2Data.peakMMR) score1++;
    else score2++;

    const winner = score1 > score2 ? player1Data : score2 > score1 ? player2Data : null;
    
    if (winner) {
      embed.setFooter({
        text: `🏆 Overall Leader: ${winner.username} (${score1 > score2 ? score1 : score2}/5 categories)`,
      });
    } else {
      embed.setFooter({
        text: `⚖️ Perfectly matched! Both players tied ${score1}/5 categories`,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Compare command error', {
      user1: user1.id,
      user2: user2.id,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while comparing players. Please try again later.',
    });
  }
}

/**
 * Get player comparison data
 */
async function getPlayerComparisonData(
  databaseService: DatabaseService,
  user: User
): Promise<PlayerComparisonStats | null> {
  try {
    const player = await databaseService.getPlayer(user.id);
    if (!player) {
      return null;
    }

    // Get player stats from match_player_stats
    const supabase = databaseService.supabase;
    const { data: statsData, error } = await supabase
      .from('match_player_stats')
      .select(`
        kills,
        deaths,
        assists,
        mvp,
        matches!inner(
          winner,
          status
        )
      `)
      .eq('player_id', player.id)
      .eq('matches.status', 'completed');

    if (error) {
      console.error('Error getting player stats', {
        userId: user.id,
        error: error.message,
      });
      return null;
    }

    // Calculate stats
    let gamesPlayed = 0;
    let wins = 0;
    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let mvps = 0;

    if (statsData && statsData.length > 0) {
      gamesPlayed = statsData.length;
      
      for (const stat of statsData) {
        // Check if won (need to compare team with winner, but we don't have team in select)
        // For now, we'll use the player model stats
        kills += stat.kills;
        deaths += stat.deaths;
        assists += stat.assists;
        if (stat.mvp) mvps++;
      }
    }

    // Get wins/losses from player stats table if available
    // For now, calculate from stored player data
    const winRate = player.stats?.wins && player.stats?.gamesPlayed 
      ? ((player.stats.wins / player.stats.gamesPlayed) * 100).toFixed(1)
      : '0.0';
    
    wins = player.stats?.wins || 0;
    const losses = player.stats?.losses || 0;
    gamesPlayed = player.stats?.gamesPlayed || gamesPlayed;
    kills = player.stats?.kills || kills;
    deaths = player.stats?.deaths || deaths;
    assists = player.stats?.assists || assists;
    mvps = player.stats?.mvps || mvps;

    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

    return {
      userId: user.id,
      username: user.username,
      rank: player.discord_rank || 'Unranked',
      mmr: player.current_mmr || 0,
      peakMMR: player.peak_mmr || 0,
      gamesPlayed,
      wins,
      losses,
      winRate: parseFloat(winRate),
      kills,
      deaths,
      assists,
      kd: parseFloat(kd),
      mvps,
    };
  } catch (error) {
    console.error('Error getting player comparison data', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
