import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ComponentType,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { PlayerService } from '../services/PlayerService';
import { VercelAPIService } from '../services/VercelAPIService';
import { RankCardService } from '../services/RankCardService';
import { RankProfileImageService } from '../services/RankProfileImageService';

// Marvel Rivals rank options for manual selection
// Values must be unique for Discord, so we use format "RANK:source_rank"
const MARVEL_RIVALS_RANK_CHOICES = [
  { label: 'Bronze I', value: 'GRNDS I:bronze1', description: 'Bronze I → GRNDS I' },
  { label: 'Bronze II', value: 'GRNDS I:bronze2', description: 'Bronze II → GRNDS I' },
  { label: 'Bronze III', value: 'GRNDS II:bronze3', description: 'Bronze III → GRNDS II' },
  { label: 'Silver I', value: 'GRNDS II:silver1', description: 'Silver I → GRNDS II' },
  { label: 'Silver II', value: 'GRNDS III:silver2', description: 'Silver II → GRNDS III' },
  { label: 'Silver III', value: 'GRNDS III:silver3', description: 'Silver III → GRNDS III' },
  { label: 'Gold I', value: 'GRNDS III:gold1', description: 'Gold I → GRNDS III' },
  { label: 'Gold II', value: 'GRNDS IV:gold2', description: 'Gold II → GRNDS IV' },
  { label: 'Gold III', value: 'GRNDS IV:gold3', description: 'Gold III → GRNDS IV' },
  { label: 'Platinum I', value: 'GRNDS IV:plat1', description: 'Platinum I → GRNDS IV' },
  { label: 'Platinum II', value: 'GRNDS V:plat2', description: 'Platinum II → GRNDS V' },
  { label: 'Platinum III', value: 'GRNDS V:plat3', description: 'Platinum III → GRNDS V' },
  { label: 'Diamond+', value: 'GRNDS V:diamond', description: 'Diamond or higher → GRNDS V (capped)' },
  { label: 'Unranked', value: 'GRNDS I:unranked', description: 'Haven\'t played ranked → GRNDS I' },
];

// Helper to extract rank from value (removes the unique suffix)
function parseManualRankValue(value: string): string {
  return value.split(':')[0];
}

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
    rankCardService?: RankCardService;
    rankProfileImageService?: RankProfileImageService;
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
    const { databaseService, vercelAPI, roleUpdateService, rankCardService, rankProfileImageService } = services;

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
          `❌ Please link your Marvel Rivals account first.\n\n**Steps:**\n1. Use \`/account marvel link username:<your_username>\`\n2. Then use \`/verify game:marvel_rivals\` to get your placement.`
        );
        return;
      }

      // Fetch fresh data from database to avoid stale cache
      const freshPlayer = await databaseService.getPlayer(userId);
      const marvelRank = freshPlayer?.marvel_rivals_rank;
      const marvelMMR = freshPlayer?.marvel_rivals_mmr || 0;

      if (marvelRank && marvelRank !== 'Unranked' && marvelMMR > 0) {
        await interaction.editReply(
          `❌ You are already placed at **${marvelRank}** (${marvelMMR} MMR) for Marvel Rivals.`
        );
        return;
      }

      if (!vercelAPI) {
        await interaction.editReply('❌ Vercel API service is not available.');
        return;
      }

      // Show loading state while we fetch from API
      const marvelLoadingEmbed = new EmbedBuilder()
        .setTitle('⏳ Fetching Your Marvel Rivals Rank...')
        .setColor(0x5865f2)
        .setDescription('Please wait while we look up your stats. This may take a moment...');

      await interaction.editReply({
        embeds: [marvelLoadingEmbed],
      });

      let verifyResult = await vercelAPI.verifyMarvelRivals({
        userId,
        username,
        marvelRivalsUid: existingPlayer.marvel_rivals_uid,
        marvelRivalsUsername: existingPlayer.marvel_rivals_username || undefined,
      });

      // Handle manual rank selection flow when API can't detect rank
      if (verifyResult.requiresManualRank) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('manual_rank_select')
          .setPlaceholder('Select your current Marvel Rivals rank')
          .addOptions(MARVEL_RIVALS_RANK_CHOICES);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        // Different message based on auto-sync status
        let descriptionText: string;
        if (verifyResult.autoSyncQueued) {
          descriptionText = 
            `We found your account **${existingPlayer.marvel_rivals_username}** but your rank data is being refreshed.\n\n` +
            `**Select your rank below to start playing now**, or wait 5-10 minutes and run \`/verify\` again for automatic detection.\n\n` +
            `✅ *Auto-sync is enabled! Your rank will update automatically once the API refreshes.*`;
        } else if (verifyResult.playerFound) {
          descriptionText = 
            `We found your account **${existingPlayer.marvel_rivals_username}** but couldn't detect your current rank.\n\n` +
            `**Select your Marvel Rivals rank below** to get placed correctly.\n\n` +
            `⚠️ *Your rank will sync automatically once the API updates. If your selection doesn't match your actual rank, it will be corrected.*`;
        } else {
          descriptionText = 
            `We couldn't load your stats right now (the API may be updating).\n\n` +
            `**Select your current Marvel Rivals rank below** to get started playing!\n\n` +
            `⚠️ *Your rank will sync automatically when the API is available. If your selection doesn't match, it will be corrected.*`;
        }

        const embed = new EmbedBuilder()
          .setTitle(verifyResult.autoSyncQueued ? '🔄 Data Refreshing - Select Your Rank' : '🎮 Help Us Place You')
          .setColor(verifyResult.autoSyncQueued ? 0x5865f2 : 0xf5a623)
          .setDescription(descriptionText);

        const response = await interaction.editReply({
          embeds: [embed],
          components: [row],
        });

        try {
          const selectInteraction = await response.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === userId && i.customId === 'manual_rank_select',
            time: 60000, // 60 second timeout
          }) as StringSelectMenuInteraction;

          await selectInteraction.deferUpdate();

          // Parse the rank from the unique value (format: "GRNDS X:source")
          const selectedRank = parseManualRankValue(selectInteraction.values[0]);
          
          // Show loading state while we process
          const loadingEmbed = new EmbedBuilder()
            .setTitle('⏳ Calculating Your Rank...')
            .setColor(0x5865f2)
            .setDescription('Please wait while we set up your placement. This may take a moment...');

          await interaction.editReply({
            embeds: [loadingEmbed],
            components: [],
          });

          // Re-verify with the manual rank
          verifyResult = await vercelAPI.verifyMarvelRivals({
            userId,
            username,
            marvelRivalsUid: existingPlayer.marvel_rivals_uid,
            marvelRivalsUsername: existingPlayer.marvel_rivals_username || undefined,
            manualRank: selectedRank,
          });

          if (!verifyResult.success) {
            await interaction.editReply({
              content: `❌ ${verifyResult.error || 'Failed to set rank. Please try again.'}`,
              embeds: [],
              components: [],
            });
            return;
          }
        } catch (error) {
          // Timeout or error
          await interaction.editReply({
            content: '⏰ Selection timed out. Please run `/verify game:marvel_rivals` again.',
            embeds: [],
            components: [],
          });
          return;
        }
      } else if (!verifyResult.success) {
        await interaction.editReply(
          `❌ ${verifyResult.error || 'Failed to verify Marvel Rivals account. Please try again later.'}`
        );
        return;
      }

      if (interaction.guild && roleUpdateService) {
        await roleUpdateService.updatePlayerRoleFromDatabase(userId, interaction.guild);
      }

      services.playerService.invalidateCache(userId);

      const wasManualRank = !!verifyResult.manualRank;
      const embed = new EmbedBuilder()
        .setTitle(wasManualRank ? '✅ Rank Set Successfully!' : '✅ Rank Placement Complete!')
        .setColor(wasManualRank ? 0xf5a623 : 0x00ff00)
        .addFields(
          {
            name: 'Marvel Rivals',
            value: existingPlayer.marvel_rivals_username,
            inline: true,
          },
          {
            name: 'Discord Rank',
            value: `**${verifyResult.marvelRivalsRank || verifyResult.discordRank || 'Unranked'}**`,
            inline: true,
          },
          {
            name: 'Starting MMR',
            value: `**${verifyResult.startingMMR || 0}**`,
            inline: true,
          }
        )
        .setFooter({
          text: wasManualRank 
            ? '⚠️ Rank set manually. It will sync automatically when the API updates.'
            : 'Your Discord rank is based on your Marvel Rivals rank. Play customs to adjust your rank!',
        });

      const attachments: AttachmentBuilder[] = [];
      const matchSummary = await databaseService.getPlayerMatchSummary(userId, {
        matchTypes: ['marvel_rivals'],
      });
      const summaryStats = matchSummary?.stats || getEmptyMatchStats();

      if (rankProfileImageService) {
        try {
          const profileBuffer = await rankProfileImageService.renderProfile({
            playerName: interaction.user.username,
            discordId: interaction.user.id,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
            gameLabel: 'Marvel Rivals',
            rankName: verifyResult.discordRank || verifyResult.marvelRivalsRank || 'Unranked',
            rankMMR: verifyResult.startingMMR || 0,
            stats: summaryStats,
            recentGames: matchSummary?.recentGames,
          });
          if (Buffer.isBuffer(profileBuffer)) {
            const attachment = new AttachmentBuilder(profileBuffer, { name: 'rank-profile.png' });
            attachments.push(attachment);
            embed.setImage('attachment://rank-profile.png');
          } else {
            console.warn('Marvel Rivals profile buffer invalid', { userId });
          }
        } catch (error) {
          console.warn('Failed to generate Marvel Rivals rank card', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (rankCardService) {
        try {
          const cardBuffer = await rankCardService.createRankCard({
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
            game: 'marvel_rivals',
            discordRank: verifyResult.discordRank || verifyResult.marvelRivalsRank || 'Unranked',
            discordMMR: verifyResult.startingMMR || 0,
            valorantRank: existingPlayer.valorant_rank || existingPlayer.discord_rank || 'Unranked',
            valorantMMR: existingPlayer.valorant_mmr || existingPlayer.current_mmr || 0,
            marvelRank: verifyResult.marvelRivalsRank || verifyResult.discordRank || 'Unranked',
            marvelMMR: verifyResult.startingMMR || 0,
          });
          if (Buffer.isBuffer(cardBuffer)) {
            const attachment = new AttachmentBuilder(cardBuffer, { name: 'rank-card.png' });
            attachments.push(attachment);
            embed.setImage('attachment://rank-card.png');
          } else {
            console.warn('Marvel Rivals rank card buffer invalid', { userId });
          }
        } catch (error) {
          console.warn('Failed to generate Marvel Rivals rank card', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await interaction.editReply({ embeds: [embed], files: attachments, components: [] });
      return;
    }

    if (!existingPlayer?.riot_name || !existingPlayer?.riot_tag || !existingPlayer?.riot_region) {
      await interaction.editReply(
        `❌ Please link your Riot ID first using \`/riot link\` before getting placed.\n\n**Steps:**\n1. Use \`/riot link name:<your_riot_name> tag:<your_riot_tag> region:<your_region>\`\n2. Then use \`/verify\` to get your initial Discord rank placement.`
      );
      return;
    }

    // Fetch fresh data from database to avoid stale cache
    const freshValorantPlayer = await databaseService.getPlayer(userId);
    const existingValorantRank = freshValorantPlayer?.valorant_rank || freshValorantPlayer?.discord_rank;
    const existingValorantMMR = freshValorantPlayer?.valorant_mmr || freshValorantPlayer?.current_mmr || 0;
    if (existingValorantRank && existingValorantRank !== 'Unranked' && existingValorantMMR > 0) {
      await interaction.editReply(
        `❌ You are already placed at **${existingValorantRank}** (${existingValorantMMR} MMR). Use \`/riot unlink\` and \`/riot link\` to change your account.`
      );
      return;
    }

    // Show loading state while we fetch from API
    const valorantLoadingEmbed = new EmbedBuilder()
      .setTitle('⏳ Fetching Your Valorant Rank...')
      .setColor(0x5865f2)
      .setDescription('Please wait while we look up your stats. This may take a moment...');

    await interaction.editReply({
      embeds: [valorantLoadingEmbed],
    });

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
    const matchSummary = await databaseService.getPlayerMatchSummary(userId, {
      matchTypes: ['valorant', 'custom'],
    });
    const summaryStats = matchSummary?.stats || getEmptyMatchStats();

    if (rankProfileImageService && verifyResult.discordRank && verifyResult.startingMMR !== undefined) {
      try {
        const profileBuffer = await rankProfileImageService.renderProfile({
          playerName: interaction.user.username,
          discordId: interaction.user.id,
          avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
          gameLabel: 'Valorant',
          rankName: verifyResult.discordRank,
          rankMMR: verifyResult.startingMMR,
          stats: summaryStats,
          recentGames: matchSummary?.recentGames,
        });
        if (Buffer.isBuffer(profileBuffer)) {
          const attachment = new AttachmentBuilder(profileBuffer, { name: 'rank-profile.png' });
          attachments.push(attachment);
          embed.setImage('attachment://rank-profile.png');
        } else {
          console.warn('Valorant profile buffer invalid', { userId });
        }
      } catch (error) {
        console.warn('Failed to generate Valorant rank profile', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (rankCardService && verifyResult.discordRank && verifyResult.startingMMR !== undefined) {
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
        if (Buffer.isBuffer(cardBuffer)) {
          const attachment = new AttachmentBuilder(cardBuffer, { name: 'rank-card.png' });
          attachments.push(attachment);
          embed.setImage('attachment://rank-card.png');
        } else {
          console.warn('Valorant rank card buffer invalid', { userId });
        }
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

function getEmptyMatchStats() {
  return {
    wins: 0,
    losses: 0,
    winrate: '0%',
    kills: 0,
    deaths: 0,
    kd: '0.00',
    mvp: 0,
    svp: 0,
    games: 0,
  };
}

