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
  .setDescription('Verify your Valorant account and get initial rank placement')
  .addStringOption((option: any) =>
    option
      .setName('name')
      .setDescription('Your Riot username')
      .setRequired(true)
  )
  .addStringOption((option: any) =>
    option
      .setName('tag')
      .setDescription('Your Riot tag (without #)')
      .setRequired(true)
  )
  .addStringOption((option: any) =>
    option
      .setName('region')
      .setDescription('Your region (na, eu, ap, kr, latam, br)')
      .setRequired(false)
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    valorantAPI?: ValorantAPIService;
    databaseService: DatabaseService;
    playerService: PlayerService;
    customRankService: CustomRankService;
  }
) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { valorantAPI, databaseService, playerService } = services;
    const name = interaction.options.getString('name', true);
    const tag = interaction.options.getString('tag', true);
    const regionInput = interaction.options.getString('region') || 'na';
    const region = regionInput.toLowerCase();

    // Validate input
    if (!name || name.length > 50 || !/^[a-zA-Z0-9]+$/.test(name)) {
      await interaction.editReply('❌ Invalid Riot username. Use only letters and numbers (1-50 characters).');
      return;
    }

    // Riot tags can contain letters and numbers (alphanumeric)
    if (!tag || tag.length < 1 || tag.length > 10 || !/^[a-zA-Z0-9]+$/.test(tag)) {
      await interaction.editReply('❌ Invalid Riot tag. Use only letters and numbers (1-10 characters).');
      return;
    }

      // Validate region
      const validRegions = ['na', 'eu', 'ap', 'kr', 'latam', 'br'];
      if (!validRegions.includes(region)) {
        await interaction.editReply('❌ Invalid region. Use: na, eu, ap, kr, latam, or br');
        return;
      }

      if (!valorantAPI) {
        await interaction.editReply('❌ Valorant API is not available. Please contact an administrator.');
        return;
      }

      // Check if already verified
      const existingPlayer = await databaseService.getPlayer(userId);
      if (existingPlayer && existingPlayer.riot_name && existingPlayer.riot_tag) {
        await interaction.editReply(
          `❌ You are already verified as **${existingPlayer.riot_name}#${existingPlayer.riot_tag}**. Use \`/riot unlink\` first to change your account.`
        );
        return;
      }

      // Step 1: Verify account exists
      const account = await valorantAPI.getAccount(name, tag);
      if (!account) {
        await interaction.editReply(
          `❌ Could not find Riot account "${name}#${tag}". Please check your username and tag.`
        );
        return;
      }

      // Step 2: Get current Valorant rank
      const mmr = await valorantAPI.getMMR(region, name, tag);
      if (!mmr) {
        await interaction.editReply(
          `❌ Could not fetch rank for "${name}#${tag}". The account may not have played ranked matches yet.`
        );
        return;
      }

      // Step 3: Map Valorant rank to custom Discord rank and MMR (capped at GRNDS V)
      const valorantRank = mmr.currenttierpatched; // e.g., "Diamond 2"
      const { customRankService } = services;
      
      // Get lifetime stats for confidence boosting (optional)
      // Note: MMR history may be slow, so we'll make it optional/non-blocking
      let lifetimeStats;
      try {
        const mmrHistory = await valorantAPI.getMMRHistory(name, tag);
        if (mmrHistory && mmrHistory.length > 0) {
          // Calculate peak rank from history
          let peakRank = mmrHistory[0].currenttierpatched;
          for (const m of mmrHistory) {
            const peakValue = customRankService.getValorantRankValue(peakRank);
            const currentValue = customRankService.getValorantRankValue(m.currenttierpatched);
            if (currentValue > peakValue) {
              peakRank = m.currenttierpatched;
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

      // Calculate initial MMR (capped at GRNDS V)
      const startingMMR = customRankService.calculateInitialMMR(
        valorantRank,
        mmr.elo,
        lifetimeStats
      );

      // Get custom rank from MMR
      const discordRank = await customRankService.getRankFromMMR(startingMMR);
      const rankValue = customRankService.getRankValue(discordRank);

      // Step 4: Update database
      await playerService.getOrCreatePlayer(userId, username);
      await databaseService.updatePlayerRiotID(userId, name, tag, account.puuid, region);
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
        .setTitle('✅ Account Verified!')
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
            value: valorantRank,
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
          `You've been placed at **${discordRank}** based on your Valorant rank. Your Discord rank will now be updated based on server matches!`
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
