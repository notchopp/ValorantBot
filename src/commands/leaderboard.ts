import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';
import { GAME_CHOICES, normalizeGameSelection, formatGameName, getGameRankFields } from '../utils/game-selection';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top players leaderboard')
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('Number of players to show (default: 10, max: 25)')
      .setMinValue(1)
      .setMaxValue(25)
  )
  .addStringOption((option) =>
    option.setName('game').setDescription('Which game leaderboard to display').addChoices(...GAME_CHOICES)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
  }
) {
  // Defer IMMEDIATELY before any async operations
  await safeDefer(interaction, false);

  try {
    const { databaseService } = services;
    const limit = interaction.options.getInteger('limit') || 10;
    const selectedGame = normalizeGameSelection(interaction.options.getString('game'));
    const mmrField = selectedGame === 'marvel_rivals' ? 'marvel_rivals_mmr' : 'valorant_mmr';
    const rankField = selectedGame === 'marvel_rivals' ? 'marvel_rivals_rank' : 'valorant_rank';

    const supabase = databaseService.supabase;
    if (!supabase) {
      await safeEditReply(interaction, {
        content: '❌ Database unavailable. Try again later.',
      });
      return;
    }
    const { data: topPlayers, error } = await supabase
      .from('players')
      .select(`id, discord_user_id, discord_username, ${mmrField}, ${rankField}, discord_rank, current_mmr, valorant_rank, valorant_mmr, valorant_peak_mmr, marvel_rivals_rank, marvel_rivals_mmr, marvel_rivals_peak_mmr`)
      .not(mmrField, 'is', null)
      .order(mmrField, { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Leaderboard query error', { error });
      await safeEditReply(interaction, {
        content: '❌ Could not fetch leaderboard.',
      });
      return;
    }
    const players = (topPlayers || []).map((player: any) => ({
      ...player,
      gameFields: getGameRankFields(player, selectedGame),
    }));

    if (players.length === 0) {
      await safeEditReply(interaction, {
        content: '❌ No players found on the leaderboard yet.',
      });
      return;
    }

    const leaderboardText = players
      .map((player: any, index: number) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const rank = player.gameFields.rank ? ` [${player.gameFields.rank}]` : '';
        return `${medal} **${player.discord_username}**${rank} - ${player.gameFields.mmr} MMR`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${formatGameName(selectedGame)} Leaderboard`)
      .setDescription(leaderboardText)
      .setColor(0xffd700)
      .setFooter({ text: `Ranked by ${formatGameName(selectedGame)} MMR • Visit /leaderboard for more` });

    await safeEditReply(interaction, { embeds: [embed] });
  } catch (error: any) {
    // Handle already acknowledged errors - don't try to reply again
    if (error?.code === 40060) {
      return;
    }

    // Only log if it's not a timeout error (timeout errors are handled silently)
    if (error?.code !== 10062) {
      console.error('Leaderboard command error', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    // Only try to send error reply if interaction hasn't been handled yet
    if (!interaction.replied) {
      await safeEditReply(interaction, {
        content: '❌ An error occurred while fetching the leaderboard. Please try again later.',
      });
    }
  }
}
