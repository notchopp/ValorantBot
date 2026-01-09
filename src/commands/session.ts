import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';

export const data = new SlashCommandBuilder()
  .setName('session')
  .setDescription("View today's gaming session summary");

interface SessionStats {
  matchesPlayed: number;
  wins: number;
  losses: number;
  totalMMRChange: number;
  startingMMR: number;
  currentMMR: number;
  kills: number;
  deaths: number;
  assists: number;
  mvps: number;
  bestGame: {
    map: string;
    kda: string;
    mmrGain: number;
  } | null;
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
  }
) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn('Interaction session timed out - user may have clicked command multiple times');
      return;
    }
    throw error;
  }

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { databaseService } = services;

    // Get player data
    const player = await databaseService.getPlayer(userId);
    if (!player) {
      try {
        await interaction.editReply(
          '❌ You are not verified. Use `/verify` to link your Riot ID and get placed.'
        );
      } catch (error: any) {
        if (error?.code === 10062) {
          console.warn('Interaction session timed out - user may have clicked command multiple times');
          return;
        }
        throw error;
      }
      return;
    }

    // Get today's session stats
    const sessionStats = await getTodaySessionStats(databaseService, player.id);

    if (sessionStats.matchesPlayed === 0) {
      try {
        await interaction.editReply(
          "📊 No games played today yet. Queue up and start grinding! 💪"
        );
      } catch (error: any) {
        if (error?.code === 10062) {
          console.warn('Interaction session timed out - user may have clicked command multiple times');
          return;
        }
        throw error;
      }
      return;
    }

    // Calculate derived stats
    const winRate = ((sessionStats.wins / sessionStats.matchesPlayed) * 100).toFixed(1);
    const kd = sessionStats.deaths > 0 
      ? (sessionStats.kills / sessionStats.deaths).toFixed(2) 
      : sessionStats.kills.toFixed(2);
    const avgMMRPerGame = (sessionStats.totalMMRChange / sessionStats.matchesPlayed).toFixed(1);

    // Determine emoji and color based on performance
    let emoji = '📊';
    let color = 0x5865f2; // Default blue
    let performanceText = 'Solid session';

    if (sessionStats.wins > sessionStats.losses) {
      emoji = '🔥';
      color = 0x00ff00; // Green
      performanceText = 'Great session!';
    } else if (sessionStats.wins < sessionStats.losses) {
      emoji = '💪';
      color = 0xff6b6b; // Red
      performanceText = 'Keep grinding!';
    }

    if (sessionStats.totalMMRChange > 50) {
      emoji = '🚀';
      performanceText = 'On fire!';
    } else if (sessionStats.totalMMRChange < -50) {
      emoji = '🎯';
      performanceText = 'Stay focused!';
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${interaction.user.username}'s Today's Session`)
      .setColor(color)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(`**${performanceText}**`);

    // Add session stats
    embed.addFields(
      {
        name: 'Games Played',
        value: `**${sessionStats.matchesPlayed}**`,
        inline: true,
      },
      {
        name: 'Record',
        value: `**${sessionStats.wins}W - ${sessionStats.losses}L** (${winRate}%)`,
        inline: true,
      },
      {
        name: 'Win Rate',
        value: `**${winRate}%**`,
        inline: true,
      }
    );

    // Add MMR changes
    const mmrChangeSign = sessionStats.totalMMRChange >= 0 ? '+' : '';
    embed.addFields(
      {
        name: 'MMR Change',
        value: `**${mmrChangeSign}${sessionStats.totalMMRChange}**`,
        inline: true,
      },
      {
        name: 'Avg Per Game',
        value: `**${(typeof avgMMRPerGame === 'number' ? avgMMRPerGame : parseFloat(String(avgMMRPerGame))) >= 0 ? '+' : ''}${avgMMRPerGame}**`,
        inline: true,
      },
      {
        name: 'Current MMR',
        value: `**${sessionStats.currentMMR}**`,
        inline: true,
      }
    );

    // Add KDA stats
    embed.addFields(
      {
        name: 'Total K/D/A',
        value: `${sessionStats.kills}/${sessionStats.deaths}/${sessionStats.assists}`,
        inline: true,
      },
      {
        name: 'K/D Ratio',
        value: `**${kd}**`,
        inline: true,
      },
      {
        name: 'MVPs',
        value: `**${sessionStats.mvps}** 👑`,
        inline: true,
      }
    );

    // Add best game if available
    if (sessionStats.bestGame) {
      embed.addFields({
        name: '🌟 Best Game',
        value: `${sessionStats.bestGame.map} | ${sessionStats.bestGame.kda} | +${sessionStats.bestGame.mmrGain} MMR`,
        inline: false,
      });
    }

    // Add motivational footer
    embed.setFooter({
      text: `Session started at midnight | Use /history for detailed match history`,
    });

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      if (error?.code === 10062) {
        console.warn('Interaction session timed out - user may have clicked command multiple times');
        return;
      }
      throw error;
    }
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn('Interaction session timed out - user may have clicked command multiple times');
      return;
    }

    console.error('Session command error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while fetching your session. Please try again later.',
      });
    } catch (replyError: any) {
      if (replyError?.code !== 10062) {
        console.error('Failed to send error reply for session command', {
          error: replyError instanceof Error ? replyError.message : String(replyError),
        });
      }
    }
  }
}

/**
 * Get today's session statistics
 */
async function getTodaySessionStats(
  databaseService: DatabaseService,
  playerId: string
): Promise<SessionStats> {
  try {
    const supabase = databaseService.supabase;
    if (!supabase) {
      console.error('Supabase not initialized');
      return {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        totalMMRChange: 0,
        startingMMR: 0,
        currentMMR: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        mvps: 0,
        bestGame: null,
      };
    }

    // Get start of today (midnight)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get all matches from today
    const { data, error } = await supabase
      .from('match_player_stats')
      .select(`
        mmr_before,
        mmr_after,
        team,
        kills,
        deaths,
        assists,
        mvp,
        matches!inner(
          match_id,
          match_date,
          map,
          winner,
          status
        )
      `)
      .eq('player_id', playerId)
      .eq('matches.status', 'completed')
      .gte('matches.match_date', startOfDay.toISOString())
      .order('matches(match_date)', { ascending: true });

    if (error || !data || data.length === 0) {
      return {
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        totalMMRChange: 0,
        startingMMR: 0,
        currentMMR: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        mvps: 0,
        bestGame: null,
      };
    }

    // Calculate stats
    let wins = 0;
    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let mvps = 0;
    let bestGame: SessionStats['bestGame'] = null;
    let bestMMRGain = -999;

    const startingMMR = data[0].mmr_before;
    const currentMMR = data[data.length - 1].mmr_after;
    const totalMMRChange = currentMMR - startingMMR;

    for (const match of data) {
      const matchData = match.matches as any;
      const won = matchData?.winner === match.team;
      const mmrChange = match.mmr_after - match.mmr_before;
      
      if (won) wins++;
      kills += match.kills || 0;
      deaths += match.deaths || 0;
      assists += match.assists || 0;
      if (match.mvp) mvps++;

      // Track best game (highest MMR gain + good KDA)
      if (mmrChange > bestMMRGain) {
        bestMMRGain = mmrChange;
        bestGame = {
          map: matchData?.map || 'Unknown',
          kda: `${match.kills || 0}/${match.deaths || 0}/${match.assists || 0}`,
          mmrGain: mmrChange,
        };
      }
    }

    return {
      matchesPlayed: data.length,
      wins,
      losses: data.length - wins,
      totalMMRChange,
      startingMMR,
      currentMMR,
      kills,
      deaths,
      assists,
      mvps,
      bestGame,
    };
  } catch (error) {
    console.error('Error getting session stats', {
      playerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      totalMMRChange: 0,
      startingMMR: 0,
      currentMMR: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      mvps: 0,
      bestGame: null,
    };
  }
}
