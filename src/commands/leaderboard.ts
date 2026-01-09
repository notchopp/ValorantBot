import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PlayerService } from '../services/PlayerService';
import { safeDefer, safeEditReply } from '../utils/interaction-helpers';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top players leaderboard')
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('Number of players to show (default: 10, max: 25)')
      .setMinValue(1)
      .setMaxValue(25)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    playerService: PlayerService;
  }
) {
  // Defer IMMEDIATELY before any async operations
  await safeDefer(interaction, false);

  try {
    const { playerService } = services;
    const limit = interaction.options.getInteger('limit') || 10;
    const topPlayers = await playerService.getTopPlayersByPoints(limit);

    if (topPlayers.length === 0) {
      await safeEditReply(interaction, {
        content: '❌ No players found. Join a queue to start tracking stats!',
      });
      return;
    }

    const leaderboardText = topPlayers
      .map((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        const rank = player.rank ? ` [${player.rank}]` : '';
        return `${medal} **${player.username}**${rank} - ${player.stats.points} pts (${player.stats.wins}W/${player.stats.losses}L)`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🏆 Leaderboard')
      .setDescription(leaderboardText)
      .setColor(0xffd700)
      .setFooter({ text: 'Ranked by total points • See full leaderboard: [grnds.xyz/leaderboard](https://grnds.xyz/leaderboard)' });

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
