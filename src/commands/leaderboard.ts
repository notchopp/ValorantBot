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
  await interaction.deferReply();

  try {
    const { playerService } = services;
    const limit = interaction.options.getInteger('limit') || 10;
    const topPlayers = await playerService.getTopPlayersByPoints(limit);

  if (topPlayers.length === 0) {
    await interaction.editReply('❌ No players found. Join a queue to start tracking stats!');
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
    .setFooter({ text: 'Ranked by total points • See full leaderboard at grnds.xyz/leaderboard' });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Leaderboard command error', {
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while fetching the leaderboard. Please try again later.',
    });
  }
}
