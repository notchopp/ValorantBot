import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('View your recent match history with MMR changes')
  .addIntegerOption((option) =>
    option
      .setName('count')
      .setDescription('Number of matches to display (1-25, default: 10)')
      .setMinValue(1)
      .setMaxValue(25)
  );

interface MatchHistoryEntry {
  matchId: string;
  matchDate: Date;
  map: string;
  won: boolean;
  team: string;
  mmrBefore: number;
  mmrAfter: number;
  mmrChange: number;
  kills: number;
  deaths: number;
  assists: number;
  mvp: boolean;
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
      console.warn('Interaction history timed out - user may have clicked command multiple times');
      return;
    }
    throw error;
  }

  const userId = interaction.user.id;
  const username = interaction.user.username;
  const count = interaction.options.getInteger('count') || 10;

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
          console.warn('Interaction history timed out - user may have clicked command multiple times');
          return;
        }
        throw error;
      }
      return;
    }

    // Get match history
    const matchHistory = await getPlayerMatchHistory(databaseService, player.id, count);

    if (!matchHistory || matchHistory.length === 0) {
      try {
        await interaction.editReply(
          '❌ No match history found. Play some games to build your history!'
        );
      } catch (error: any) {
        if (error?.code === 10062) {
          console.warn('Interaction history timed out - user may have clicked command multiple times');
          return;
        }
        throw error;
      }
      return;
    }

    // Calculate stats from history
    const wins = matchHistory.filter(m => m.won).length;
    const losses = matchHistory.length - wins;
    const totalMMRChange = matchHistory.reduce((sum, m) => sum + m.mmrChange, 0);
    const winRate = ((wins / matchHistory.length) * 100).toFixed(1);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📜 ${interaction.user.username}'s Match History`)
      .setColor(0x5865f2)
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(`Last ${matchHistory.length} matches`)
      .addFields(
        {
          name: 'Record',
          value: `${wins}W - ${losses}L (${winRate}%)`,
          inline: true,
        },
        {
          name: 'Total MMR Change',
          value: `**${totalMMRChange >= 0 ? '+' : ''}${totalMMRChange}**`,
          inline: true,
        },
        {
          name: 'Current MMR',
          value: `**${player.current_mmr}**`,
          inline: true,
        }
      );

    // Add match entries (up to 10 in embed fields, rest in description)
    const displayCount = Math.min(matchHistory.length, 10);
    
    for (let i = 0; i < displayCount; i++) {
      const match = matchHistory[i];
      const resultEmoji = match.won ? '✅' : '❌';
      const mvpBadge = match.mvp ? ' 👑' : '';
      const mmrSign = match.mmrChange >= 0 ? '+' : '';
      
      // Format date
      const date = new Date(match.matchDate);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      embed.addFields({
        name: `${resultEmoji} ${match.map} • ${dateStr}${mvpBadge}`,
        value: `K/D/A: ${match.kills}/${match.deaths}/${match.assists} | MMR: ${mmrSign}${match.mmrChange} (${match.mmrBefore} → ${match.mmrAfter})`,
        inline: false,
      });
    }

    // If there are more matches than we can display, add a note
    if (matchHistory.length > displayCount) {
      embed.setFooter({
        text: `Showing ${displayCount} of ${matchHistory.length} matches. Increase count to see more.`,
      });
    } else {
      embed.setFooter({
        text: 'Use /streak to see your current win/loss streak',
      });
    }

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      if (error?.code === 10062) {
        console.warn('Interaction history timed out - user may have clicked command multiple times');
        return;
      }
      throw error;
    }
  } catch (error: any) {
    if (error?.code === 10062) {
      console.warn('Interaction history timed out - user may have clicked command multiple times');
      return;
    }

    console.error('History command error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while fetching your match history. Please try again later.',
      });
    } catch (replyError: any) {
      if (replyError?.code !== 10062) {
        console.error('Failed to send error reply for history command', {
          error: replyError instanceof Error ? replyError.message : String(replyError),
        });
      }
    }
  }
}

/**
 * Get player match history with detailed stats
 */
async function getPlayerMatchHistory(
  databaseService: DatabaseService,
  playerId: string,
  limit: number
): Promise<MatchHistoryEntry[]> {
  try {
    const supabase = databaseService.supabase;
    if (!supabase) {
      console.error('Supabase not initialized');
      return [];
    }

    // Get match player stats with match details
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
      .order('matches(match_date)', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('Error getting match history', { playerId, error });
      return [];
    }

    // Convert to MatchHistoryEntry format
    const history: MatchHistoryEntry[] = data.map((stat: any) => {
      const won = stat.matches.winner === stat.team;
      const mmrChange = stat.mmr_after - stat.mmr_before;
      
      return {
        matchId: stat.matches.match_id,
        matchDate: new Date(stat.matches.match_date),
        map: stat.matches.map,
        won,
        team: stat.team,
        mmrBefore: stat.mmr_before,
        mmrAfter: stat.mmr_after,
        mmrChange,
        kills: stat.kills,
        deaths: stat.deaths,
        assists: stat.assists,
        mvp: stat.mvp,
      };
    });

    return history;
  } catch (error) {
    console.error('Error getting player match history', {
      playerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
