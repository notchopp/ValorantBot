import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { PlayerService } from '../services/PlayerService';
import { getKD, getWinRate } from '../models/Player';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View player statistics')
  .addUserOption((option) =>
    option.setName('user').setDescription('User to view stats for (defaults to you)')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    playerService: PlayerService;
  }
) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') || interaction.user;
  const userId = targetUser.id;
  const username = targetUser.username;

  try {
    const { playerService } = services;
    const player = await playerService.getPlayer(userId);

    if (!player) {
      await interaction.editReply(
        `❌ No stats found for ${username}. They need to join a queue first.`
      );
      return;
    }

    const kd = getKD(player);
    const winRate = getWinRate(player);

    const embed = new EmbedBuilder()
      .setTitle(`${username}'s Statistics`)
      .setColor(0x00ff00)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        {
          name: 'Games Played',
          value: player.stats.gamesPlayed.toString(),
          inline: true,
        },
        {
          name: 'Wins',
          value: player.stats.wins.toString(),
          inline: true,
        },
        {
          name: 'Losses',
          value: player.stats.losses.toString(),
          inline: true,
        },
        {
          name: 'Win Rate',
          value: `${winRate}%`,
          inline: true,
        },
        {
          name: 'Kills',
          value: player.stats.kills.toString(),
          inline: true,
        },
        {
          name: 'Deaths',
          value: player.stats.deaths.toString(),
          inline: true,
        },
        {
          name: 'K/D Ratio',
          value: kd.toFixed(2),
          inline: true,
        },
        {
          name: 'Points',
          value: player.stats.points.toString(),
          inline: true,
        },
        {
          name: 'MVPs',
          value: player.stats.mvps.toString(),
          inline: true,
        }
      );

    if (player.rank) {
      embed.addFields({
        name: 'Current Rank',
        value: player.rank,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Stats command error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred while fetching stats. Please try again later.',
    });
  }
}
