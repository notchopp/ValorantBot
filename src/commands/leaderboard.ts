import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PlayerService } from '../services/PlayerService';

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
  try {
    await interaction.deferReply();
  } catch (error: any) {
    // If defer fails (e.g., interaction already expired), just return
    if (error?.code === 10062) {
      console.warn('Interaction leaderboard timed out - user may have clicked command multiple times');
      return;
    }
    throw error; // Re-throw if it's a different error
  }

  try {
    const { playerService } = services;
    const limit = interaction.options.getInteger('limit') || 10;
    const topPlayers = await playerService.getTopPlayersByPoints(limit);

    if (topPlayers.length === 0) {
      try {
        await interaction.editReply('❌ No players found. Join a queue to start tracking stats!');
      } catch (error: any) {
        if (error?.code === 10062) {
          console.warn('Interaction leaderboard timed out - user may have clicked command multiple times');
          return;
        }
        throw error;
      }
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

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
      if (error?.code === 10062) {
        console.warn('Interaction leaderboard timed out - user may have clicked command multiple times');
        return;
      }
      throw error;
    }
  } catch (error: any) {
    // Handle interaction timeout errors gracefully
    if (error?.code === 10062) {
      console.warn('Interaction leaderboard timed out - user may have clicked command multiple times');
      return;
    }

    console.error('Leaderboard command error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    try {
      await interaction.editReply({
        content: '❌ An error occurred while fetching the leaderboard. Please try again later.',
      });
    } catch (replyError: any) {
      // If we can't reply (e.g., interaction expired), just log it
      if (replyError?.code !== 10062) {
        console.error('Failed to send error reply for leaderboard command', {
          error: replyError instanceof Error ? replyError.message : String(replyError),
        });
      }
    }
  }
}
