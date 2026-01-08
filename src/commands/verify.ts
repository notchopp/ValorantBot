import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { PlayerService } from '../services/PlayerService';
import { VercelAPIService } from '../services/VercelAPIService';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Get your initial Discord rank placement using your linked Riot ID');

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    playerService: PlayerService;
    vercelAPI: VercelAPIService;
    roleUpdateService: any; // RoleUpdateService
  }
) {
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Defer reply immediately to prevent timeout (3 second limit)
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (error: any) {
    // If defer fails (e.g., interaction expired), log and return
    if (error?.code === 10062) {
      console.warn(`Verify interaction timed out for user ${userId} - interaction may have expired`);
      return;
    }
    // Re-throw other errors
    throw error;
  }

  try {
    const { databaseService, vercelAPI, roleUpdateService } = services;

    console.log('Verify command started', { userId, username });

    // Check if Riot ID is linked (via /riot link) - check database directly
    const existingPlayer = await databaseService.getPlayer(userId);
    if (!existingPlayer?.riot_name || !existingPlayer?.riot_tag || !existingPlayer?.riot_region) {
      await interaction.editReply(
        `❌ Please link your Riot ID first using \`/riot link\` before getting placed.\n\n**Steps:**\n1. Use \`/riot link name:<your_riot_name> tag:<your_riot_tag> region:<your_region>\`\n2. Then use \`/verify\` to get your initial Discord rank placement.`
      );
      return;
    }

    // Check if already placed (has Discord rank assigned)
    if (existingPlayer.discord_rank && existingPlayer.discord_rank !== 'Unranked' && existingPlayer.current_mmr > 0) {
      await interaction.editReply(
        `❌ You are already placed at **${existingPlayer.discord_rank}** (${existingPlayer.current_mmr} MMR). Use \`/riot unlink\` and \`/riot link\` to change your account.`
      );
      return;
    }

    // Call Vercel Cloud Agent to handle verification
    console.log('Calling Vercel API for verification', {
      userId,
      riotName: existingPlayer.riot_name,
      riotTag: existingPlayer.riot_tag,
      region: existingPlayer.riot_region,
    });

    const verifyResult = await vercelAPI.verifyAccount({
      userId,
      username,
      riotName: existingPlayer.riot_name,
      riotTag: existingPlayer.riot_tag,
      region: existingPlayer.riot_region,
    });

    console.log('Vercel API response received', {
      userId,
      success: verifyResult.success,
      error: verifyResult.error,
    });

    if (!verifyResult.success) {
      await interaction.editReply(
        `❌ ${verifyResult.error || 'Failed to verify account. Please try again later.'}`
      );
      return;
    }

    // Update Discord role if verification succeeded
    if (interaction.guild && verifyResult.discordRank) {
      try {
        await roleUpdateService.updatePlayerRole(
          userId,
          existingPlayer.discord_rank || 'Unranked',
          verifyResult.discordRank,
          interaction.guild
        );
      } catch (error) {
        console.warn('Failed to update Discord role after verification', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue - role update is non-critical
      }
    }

    // Invalidate cache
    services.playerService.invalidateCache(userId);

    // Create success embed with results from Vercel
    const embed = new EmbedBuilder()
      .setTitle('✅ Rank Placement Complete!')
      .setColor(0x00ff00)
      .addFields(
        {
          name: 'Riot ID',
          value: `${existingPlayer.riot_name}#${existingPlayer.riot_tag}`,
          inline: true,
        },
        {
          name: 'Region',
          value: existingPlayer.riot_region.toUpperCase(),
          inline: true,
        },
        {
          name: 'Valorant Rank',
          value: verifyResult.valorantRank || 'N/A',
          inline: true,
        },
        {
          name: 'Initial Discord Rank',
          value: verifyResult.discordRank || 'Unranked',
          inline: true,
        },
        {
          name: 'Starting MMR',
          value: verifyResult.startingMMR?.toString() || '0',
          inline: true,
        }
      )
      .setDescription(
        verifyResult.message || 
        `You've been placed at **${verifyResult.discordRank}** (${verifyResult.startingMMR} MMR). Your Discord rank will now be updated based on server matches!`
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Verify command error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
    });
    
    await interaction.editReply({
      content: '❌ An error occurred during verification. Please try again later.',
    });
  }
}

