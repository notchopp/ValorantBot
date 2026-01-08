import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  GuildMember,
  Role,
  MessageFlags,
} from 'discord.js';
import { ValorantAPIService } from '../services/ValorantAPIService';
import { DatabaseService } from '../services/DatabaseService';
import { PlayerService } from '../services/PlayerService';
import { CustomRankService } from '../services/CustomRankService';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Get your initial Discord rank placement using your linked Riot ID');

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    valorantAPI?: ValorantAPIService;
    databaseService: DatabaseService;
    playerService: PlayerService;
    customRankService: CustomRankService;
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
    const { valorantAPI, databaseService, playerService, customRankService } = services;

    if (!valorantAPI) {
      await interaction.editReply('❌ Valorant API is not available. Please contact an administrator.');
      return;
    }

    // Check if already placed (has Discord rank assigned)
    const existingPlayer = await databaseService.getPlayer(userId);
    if (existingPlayer && existingPlayer.discord_rank && existingPlayer.discord_rank !== 'Unranked' && existingPlayer.current_mmr > 0) {
      await interaction.editReply(
        `❌ You are already placed at **${existingPlayer.discord_rank}** (${existingPlayer.current_mmr} MMR). Use \`/riot unlink\` and \`/riot link\` to change your account.`
      );
      return;
    }

    // Check if Riot ID is linked (via /riot link) - check database directly
    if (!existingPlayer?.riot_name || !existingPlayer?.riot_tag || !existingPlayer?.riot_region) {
      await interaction.editReply(
        `❌ Please link your Riot ID first using \`/riot link\` before getting placed.\n\n**Steps:**\n1. Use \`/riot link name:<your_riot_name> tag:<your_riot_tag> region:<your_region>\`\n2. Then use \`/verify\` to get your initial Discord rank placement.`
      );
      return;
    }

    // Use the linked Riot ID from database
    const name = existingPlayer.riot_name;
    const tag = existingPlayer.riot_tag;
    const region = existingPlayer.riot_region;

    // Step 1: Get current Valorant rank (refresh from API)
    let mmr = await valorantAPI.getMMR(region, name, tag);
    let valorantRank: string;
    let valorantELO: number;
    let isUnrated = false;
    
    // Check if player is unrated (no current rank or unrated status)
    if (!mmr || !mmr.currenttierpatched || mmr.currenttierpatched.toLowerCase().includes('unrated')) {
      // Player is unrated - get last ranked rank from previous act/season
      isUnrated = true;
      try {
        const mmrHistory = await valorantAPI.getMMRHistory(name, tag);
        if (mmrHistory && mmrHistory.length > 0) {
          // Filter out all unrated entries and find the most recent ranked entry
          // This will be from a previous act/season (before current placements)
          const rankedEntries = mmrHistory.filter(m => 
            m.currenttierpatched && 
            !m.currenttierpatched.toLowerCase().includes('unrated') &&
            m.currenttier > 0 // Ensure it's an actual rank tier
          );
          
          if (rankedEntries.length > 0) {
            // Sort by date (most recent first) to get the last ranked rank
            const sortedRanked = [...rankedEntries].sort((a, b) => b.date_raw - a.date_raw);
            const lastRanked = sortedRanked[0]; // Most recent ranked entry
            
            valorantRank = lastRanked.currenttierpatched;
            valorantELO = lastRanked.elo;
          } else {
            await interaction.editReply(
              `❌ Could not find a ranked rank from previous acts/seasons for "${name}#${tag}". Please complete your placement matches first, or ensure you have played ranked in a previous act.`
            );
            return;
          }
        } else {
          await interaction.editReply(
            `❌ Could not fetch rank history for "${name}#${tag}". The account may not have played ranked matches yet.`
          );
          return;
        }
      } catch (error) {
        await interaction.editReply(
          `❌ Could not fetch rank for "${name}#${tag}". The account may not have played ranked matches yet.`
        );
        return;
      }
    } else {
      // Player has current rank
      valorantRank = mmr.currenttierpatched;
      valorantELO = mmr.elo;
    }

    // Step 2: Get lifetime stats for confidence boosting (optional)
    // Note: MMR history may be slow, so we'll make it optional/non-blocking
    let lifetimeStats;
    try {
      const mmrHistory = await valorantAPI.getMMRHistory(name, tag);
      if (mmrHistory && mmrHistory.length > 0) {
        // Calculate peak rank from history
        let peakRank = mmrHistory[0].currenttierpatched;
        for (const m of mmrHistory) {
          if (m.currenttierpatched && !m.currenttierpatched.toLowerCase().includes('unrated')) {
            const peakValue = customRankService.getValorantRankValue(peakRank);
            const currentValue = customRankService.getValorantRankValue(m.currenttierpatched);
            if (currentValue > peakValue) {
              peakRank = m.currenttierpatched;
            }
          }
        }

        lifetimeStats = {
          gamesPlayed: mmrHistory.length,
          wins: mmrHistory.filter(m => m.mmr_change_to_last_game > 0).length,
          peakRank,
        };
      }
    } catch (error) {
      // Non-critical - continue without lifetime stats
      console.warn('Could not fetch MMR history for confidence boosting', {
        name,
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 3: Calculate initial MMR (capped at GRNDS V)
    const startingMMR = customRankService.calculateInitialMMR(
      valorantRank,
      valorantELO,
      lifetimeStats
    );

    // Get custom rank from MMR
    const discordRank = await customRankService.getRankFromMMR(startingMMR);
    const rankValue = customRankService.getRankValue(discordRank);

    // Step 4: Update database with Discord rank placement
    await playerService.getOrCreatePlayer(userId, username);
    await databaseService.updatePlayerRank(userId, discordRank, rankValue, startingMMR);

    // Step 5: Assign Discord role
    if (interaction.guild && interaction.member) {
      const member = await interaction.guild.members.fetch(userId);
      await assignRankRole(member, discordRank, interaction.guild);
    }

    // Invalidate cache
    playerService.invalidateCache(userId);

    // Step 6: Log rank history (initial placement)
    const dbPlayer = await databaseService.getPlayer(userId);
    if (dbPlayer) {
      await databaseService.logRankChange(
        dbPlayer.id,
        'Unranked',
        discordRank,
        0,
        startingMMR,
        'verification'
      );
    }

    // Create success embed
    const embed = new EmbedBuilder()
      .setTitle('✅ Rank Placement Complete!')
      .setColor(0x00ff00)
      .addFields(
        {
          name: 'Riot ID',
          value: `${name}#${tag}`,
          inline: true,
        },
        {
          name: 'Region',
          value: region.toUpperCase(),
          inline: true,
        },
        {
          name: 'Valorant Rank',
          value: isUnrated ? `${valorantRank} (from last ranked)` : valorantRank,
          inline: true,
        },
          {
            name: 'Initial Discord Rank',
            value: discordRank,
            inline: true,
          },
          {
            name: 'Starting MMR',
            value: startingMMR.toString(),
            inline: true,
          }
        )
        .setDescription(
          isUnrated 
            ? `You've been placed at **${discordRank}** (${startingMMR} MMR) based on your last ranked rank (you are currently unrated). Your Discord rank will now be updated based on server matches!`
            : `You've been placed at **${discordRank}** (${startingMMR} MMR) based on your Valorant rank. Your Discord rank will now be updated based on server matches!`
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

// Old functions removed - now handled by CustomRankService

/**
 * Assign Discord rank role to member
 * Follows guardrails: error handling, logging
 */
async function assignRankRole(member: GuildMember, rank: string, guild: any): Promise<void> {
  try {
    // Remove existing custom rank roles
    const customRankNames = [
      'grnds', 'breakpoint', 'challenger', 'x'
    ];
    
    const rankRoles = member.roles.cache.filter((role) => {
      const roleName = role.name.toLowerCase();
      return customRankNames.some(rn => roleName.includes(rn));
    });

    for (const role of rankRoles.values()) {
      try {
        await member.roles.remove(role, 'Rank updated via /verify');
      } catch (error) {
        console.error('Error removing rank role', {
          roleId: role.id,
          roleName: role.name,
          userId: member.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Find and assign new rank role
    const rankRole = guild.roles.cache.find((role: Role | any) => {
      if (!role || !role.name) return false;
      const roleName = role.name.toLowerCase();
      const rankLower = rank.toLowerCase();
      // Match exact rank (e.g., "GRNDS V" matches role "GRNDS V")
      return roleName === rankLower || roleName.includes(rankLower.split(' ')[0]);
    });

    if (rankRole) {
      await member.roles.add(rankRole, 'Initial rank placement via /verify');
      console.log('Rank role assigned', {
        userId: member.id,
        username: member.user.username,
        rank,
        roleId: rankRole.id,
      });
    } else {
      console.warn('Rank role not found', {
        rank,
        guildId: guild.id,
        availableRoles: guild.roles.cache.map((r: Role) => r.name).slice(0, 10),
      });
    }
  } catch (error) {
    console.error('Error assigning rank role', {
      userId: member.id,
      username: member.user.username,
      rank,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - role assignment failure shouldn't break verification
  }
}
