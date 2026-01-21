import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';
import { GAME_CHOICES, resolveGameForPlayer, getGameRankFields, formatGameName } from '../utils/game-selection';

export const data = new SlashCommandBuilder()
  .setName('history')
  .setDescription('View your recent match history with MMR changes')
  .addIntegerOption((option) =>
    option
      .setName('count')
      .setDescription('Number of matches to display (1-25, default: 10)')
      .setMinValue(1)
      .setMaxValue(25)
  )
  .addStringOption((option) =>
    option.setName('game').setDescription('Which game to display').addChoices(...GAME_CHOICES)
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
  matchType: 'custom' | 'valorant' | 'marvel_rivals';
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
  }
) {
  // Defer IMMEDIATELY before any async operations
  await safeDefer(interaction, true);

  const userId = interaction.user.id;
  const username = interaction.user.username;
  const count = interaction.options.getInteger('count') || 10;

  try {
    const { databaseService } = services;

    // Get player data
    const player = await databaseService.getPlayer(userId);
    if (!player) {
      await safeEditReply(interaction, {
        content: '❌ You are not verified. Use `/verify` to link your Riot ID and get placed.',
      });
      return;
    }

    // Get match history
    const selectedGame = resolveGameForPlayer(player, interaction.options.getString('game'));
    const matchHistory = await getPlayerMatchHistory(databaseService, player.id, count, selectedGame);

    if (!matchHistory || matchHistory.length === 0) {
      await safeEditReply(interaction, {
        content: '❌ No match history found. Play some games to build your history!',
      });
      return;
    }

    // Calculate stats from history
    const wins = matchHistory.filter(m => m.won).length;
    const losses = matchHistory.length - wins;
    const totalMMRChange = matchHistory.reduce((sum, m) => sum + m.mmrChange, 0);
    const winRate = ((wins / matchHistory.length) * 100).toFixed(1);

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle(`📜 ${interaction.user.username}'s ${formatGameName(selectedGame)} Match History`)
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
          name: `${formatGameName(selectedGame)} MMR`,
          value: `**${getGameRankFields(player, selectedGame).mmr}**`,
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

    await safeEditReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    // Handle already acknowledged errors - don't try to reply again
    if (error?.code === 40060) {
      return;
    }

    // Only log if it's not a timeout error (timeout errors are handled silently)
    if (error?.code !== 10062) {
      console.error('History command error', {
        userId,
        username,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    // Only try to send error reply if interaction hasn't been handled yet
    if (!interaction.replied) {
      await safeEditReply(interaction, {
        content: '❌ An error occurred while fetching your match history. Please try again later.',
      });
    }
  }
}

/**
 * Get player match history with detailed stats
 */
async function getPlayerMatchHistory(
  databaseService: DatabaseService,
  playerId: string,
  limit: number,
  game: 'valorant' | 'marvel_rivals'
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
        match_type
      )
      `)
      .eq('player_id', playerId)
      .eq('matches.status', 'completed')
      .eq('matches.match_type', game === 'marvel_rivals' ? 'marvel_rivals' : 'custom')
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
        matchType: stat.matches.match_type,
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
