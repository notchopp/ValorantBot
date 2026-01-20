import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  AttachmentBuilder,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { PlayerService } from '../services/PlayerService';
import { VercelAPIService } from '../services/VercelAPIService';
import { MarvelRivalsAPIService } from '../services/MarvelRivalsAPIService';
import { RankService } from '../services/RankService';
import { RankCardService } from '../services/RankCardService';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Get your initial Discord rank placement using your linked game account')
  .addStringOption((option) =>
    option
      .setName('game')
      .setDescription('Select which game to verify')
      .addChoices(
        { name: 'Valorant', value: 'valorant' },
        { name: 'Marvel Rivals', value: 'marvel_rivals' }
      )
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    playerService: PlayerService;
    vercelAPI: VercelAPIService;
    marvelRivalsAPI?: MarvelRivalsAPIService;
    rankService?: RankService;
    rankCardService?: RankCardService;
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
    const { databaseService, vercelAPI, roleUpdateService, marvelRivalsAPI, rankService, rankCardService } = services;

    console.log('Verify command started', { userId, username });

    // Check if Riot ID is linked (via /riot link) - check database directly
    const existingPlayer = await databaseService.getPlayer(userId);
    const selectedGame = (interaction.options.getString('game') as 'valorant' | 'marvel_rivals' | null) || undefined;
    const preferredGame = selectedGame || existingPlayer?.preferred_game || 'valorant';

    if (selectedGame && existingPlayer && selectedGame !== existingPlayer.preferred_game) {
      await databaseService.setPlayerPreferredGame(userId, selectedGame);
    }

    if (preferredGame === 'marvel_rivals') {
      if (!existingPlayer?.marvel_rivals_uid || !existingPlayer?.marvel_rivals_username) {
        await interaction.editReply(
          `❌ Please link your Marvel Rivals account first using \`/marvel link\`.\n\n**Steps:**\n1. Use \`/marvel link username:<your_username>\`\n2. Then use \`/verify game:marvel_rivals\` to get your placement.`
        );
        return;
      }

      if (existingPlayer.marvel_rivals_rank && existingPlayer.marvel_rivals_rank !== 'Unranked' && (existingPlayer.marvel_rivals_mmr || 0) > 0) {
        await interaction.editReply(
          `❌ You are already placed at **${existingPlayer.marvel_rivals_rank}** (${existingPlayer.marvel_rivals_mmr} MMR) for Marvel Rivals.`
        );
        return;
      }

      if (!marvelRivalsAPI || !rankService) {
        await interaction.editReply('❌ Marvel Rivals API service is not available.');
        return;
      }

      const stats = await marvelRivalsAPI.getPlayerStats(existingPlayer.marvel_rivals_uid);
      if (!stats) {
        await interaction.editReply('❌ Could not fetch Marvel Rivals stats. Please try again later.');
        return;
      }

      const mapped = rankService.getMarvelRivalsDiscordRank(stats);
      if (!mapped) {
        await interaction.editReply('❌ Could not parse Marvel Rivals rank from API response.');
        return;
      }

      const updateSuccess = await databaseService.updatePlayerRank(
        userId,
        mapped.rank,
        mapped.rankValue,
        mapped.mmr,
        'marvel_rivals'
      );

      if (!updateSuccess) {
        await interaction.editReply('❌ Failed to save Marvel Rivals rank. Please try again later.');
        return;
      }

      const playerAfter = await databaseService.getPlayer(userId);
      if (playerAfter) {
        await databaseService.logRankChange(
          playerAfter.id,
          existingPlayer.marvel_rivals_rank || 'Unranked',
          mapped.rank,
          existingPlayer.marvel_rivals_mmr || 0,
          mapped.mmr,
          'verification'
        );
      }

      if (interaction.guild && roleUpdateService) {
        await roleUpdateService.updatePlayerRoleFromDatabase(userId, interaction.guild);
      }

      services.playerService.invalidateCache(userId);

      const embed = new EmbedBuilder()
        .setTitle('✅ Rank Placement Complete!')
        .setColor(0x00ff00)
        .addFields(
          {
            name: 'Marvel Rivals',
            value: existingPlayer.marvel_rivals_username,
            inline: true,
          },
          {
            name: 'Discord Rank',
            value: `**${mapped.rank}**`,
            inline: true,
          },
          {
            name: 'Starting MMR',
            value: `**${mapped.mmr}**`,
            inline: true,
          }
        )
        .setFooter({
          text: 'Your Discord rank is based on your Marvel Rivals rank. Play customs to adjust your rank!',
        });

      const attachments: AttachmentBuilder[] = [];

      if (rankCardService) {
        try {
          const cardBuffer = await rankCardService.createRankCard({
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
            game: 'marvel_rivals',
            discordRank: mapped.rank,
            discordMMR: mapped.mmr,
            valorantRank: existingPlayer.valorant_rank || existingPlayer.discord_rank || 'Unranked',
            valorantMMR: existingPlayer.valorant_mmr || existingPlayer.current_mmr || 0,
            marvelRank: mapped.rank,
            marvelMMR: mapped.mmr,
          });
          const attachment = new AttachmentBuilder(cardBuffer, { name: 'rank-card.png' });
          attachments.push(attachment);
          embed.setImage('attachment://rank-card.png');
        } catch (error) {
          console.warn('Failed to generate Marvel Rivals rank card', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await interaction.editReply({ embeds: [embed], files: attachments });
      return;
    }

    if (!existingPlayer?.riot_name || !existingPlayer?.riot_tag || !existingPlayer?.riot_region) {
      await interaction.editReply(
        `❌ Please link your Riot ID first using \`/riot link\` before getting placed.\n\n**Steps:**\n1. Use \`/riot link name:<your_riot_name> tag:<your_riot_tag> region:<your_region>\`\n2. Then use \`/verify\` to get your initial Discord rank placement.`
      );
      return;
    }

    // Check if already placed for Valorant
    const existingValorantRank = existingPlayer.valorant_rank || existingPlayer.discord_rank;
    const existingValorantMMR = existingPlayer.valorant_mmr || existingPlayer.current_mmr || 0;
    if (existingValorantRank && existingValorantRank !== 'Unranked' && existingValorantMMR > 0) {
      await interaction.editReply(
        `❌ You are already placed at **${existingValorantRank}** (${existingValorantMMR} MMR). Use \`/riot unlink\` and \`/riot link\` to change your account.`
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

    if (verifyResult.discordRank && verifyResult.discordRankValue !== undefined && verifyResult.startingMMR !== undefined) {
      await databaseService.updatePlayerRank(
        userId,
        verifyResult.discordRank,
        verifyResult.discordRankValue,
        verifyResult.startingMMR,
        'valorant'
      );
    }

    // Update Discord role if verification succeeded
    if (interaction.guild && verifyResult.discordRank && roleUpdateService) {
      try {
        console.log('🎭 Assigning Discord role after verification', {
          userId,
          username,
          rank: verifyResult.discordRank,
          guildId: interaction.guild.id,
          guildName: interaction.guild.name,
        });

        await roleUpdateService.updatePlayerRoleFromDatabase(userId, interaction.guild);

        console.log('✅ Discord role assigned successfully', {
          userId,
          username,
          newRank: verifyResult.discordRank,
        });
      } catch (error) {
        console.error('❌ Failed to assign Discord role after verification', {
          userId,
          username,
          rank: verifyResult.discordRank,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Continue - role update is non-critical for verification
        // Add a follow-up message to inform user
        try {
          await interaction.followUp({
            content: `⚠️ Verification complete but role assignment failed for rank **${verifyResult.discordRank}**. Please contact an admin.`,
            flags: MessageFlags.Ephemeral,
          });
        } catch (followUpError) {
          // Ignore if followUp fails
          console.warn('Could not send role failure follow-up', {
            error: followUpError instanceof Error ? followUpError.message : String(followUpError),
          });
        }
      }
    } else {
      if (!interaction.guild) {
        console.warn('⚠️ Cannot assign role: not in a guild', { userId });
      } else if (!verifyResult.discordRank) {
        console.warn('⚠️ Cannot assign role: no discordRank in result', { userId });
      } else if (!roleUpdateService) {
        console.warn('⚠️ Cannot assign role: roleUpdateService not available', { userId });
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
          // Empty field for Discord's 3-column embed layout spacing
          // Unicode zero-width space (\u200B) creates a blank column
          name: '\u200B',
          value: '\u200B',
          inline: true,
        },
        {
          name: 'Valorant Rank',
          value: verifyResult.valorantRank || 'Unrated',
          inline: true,
        },
        {
          name: 'Discord Rank',
          value: `**${verifyResult.discordRank}**`,
          inline: true,
        },
        {
          name: 'Starting MMR',
          value: `**${verifyResult.startingMMR}**`,
          inline: true,
        }
      );

    // Add footer with context-appropriate message
    if (verifyResult.valorantRank && verifyResult.valorantRank !== 'Unrated' && !verifyResult.valorantRank.includes('in placements')) {
      embed.setFooter({
        text: 'Your Discord rank is based on your Valorant rank. Play customs to adjust your rank!',
      });
    } else {
      embed.setFooter({
        text: 'Play customs to rank up! Use /riot refresh after getting ranked in Valorant.',
      });
    }

    const attachments: AttachmentBuilder[] = [];

    if (rankCardService && verifyResult.discordRank && verifyResult.startingMMR !== undefined) {
      try {
        const cardBuffer = await rankCardService.createRankCard({
          username: interaction.user.username,
          avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
          game: 'valorant',
          discordRank: verifyResult.discordRank,
          discordMMR: verifyResult.startingMMR,
          valorantRank: verifyResult.discordRank,
          valorantMMR: verifyResult.startingMMR,
          marvelRank: existingPlayer.marvel_rivals_rank || 'Unranked',
          marvelMMR: existingPlayer.marvel_rivals_mmr || 0,
        });
        const attachment = new AttachmentBuilder(cardBuffer, { name: 'rank-card.png' });
        attachments.push(attachment);
        embed.setImage('attachment://rank-card.png');
      } catch (error) {
        console.warn('Failed to generate Valorant rank card', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await interaction.editReply({ embeds: [embed], files: attachments });
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

