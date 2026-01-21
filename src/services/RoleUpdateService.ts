import { GuildMember, Role, Guild } from 'discord.js';
import { DatabaseService } from './DatabaseService';
import { Config } from '../config/config';

/**
 * Service for automatically updating Discord roles based on rank changes
 * Follows guardrails: error handling, logging, type safety
 */
export class RoleUpdateService {
  // Standard rank names used across the bot
  private static readonly RANK_NAMES = ['grnds', 'breakpoint', 'challenger', 'absolute', 'x'];
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService, _config: Config) {
    this.dbService = dbService;
  }

  /**
   * Update Discord role for a player based on rank change
   * Input: { userId, oldRank, newRank, guild }
   * Behavior: Remove old rank role, assign new rank role, send notification
   * Follows guardrails: error handling, logging, null checks
   */
  async updatePlayerRole(
    userId: string,
    oldRank: string,
    newRank: string,
    guild: Guild
  ): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('🎭 Starting role update process', {
        userId,
        oldRank,
        newRank,
        guildId: guild.id,
        guildName: guild.name,
      });

      // Validate inputs
      if (!userId || !guild) {
        console.error('❌ Invalid inputs for role update', {
          userId,
          guildId: guild?.id,
        });
        return { success: false, message: 'Invalid inputs' };
      }

      // Get guild member
      let member: GuildMember;
      try {
        console.log('👤 Fetching guild member', { userId, guildId: guild.id });
        member = await guild.members.fetch(userId);
        console.log('✅ Member fetched successfully', {
          userId: member.id,
          username: member.user.username,
          displayName: member.displayName,
          currentRoles: member.roles.cache.map(r => r.name),
        });
      } catch (error) {
        console.error('❌ Failed to fetch guild member', {
          userId,
          guildId: guild.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return { success: false, message: 'Member not found in guild' };
      }

      // Remove old rank role (if exists and not 'Unranked')
      if (oldRank && oldRank !== 'Unranked') {
        console.log('🗑️ Removing old rank role', { oldRank });
        await this.removeRankRole(member, oldRank, newRank, guild);
      }

      // Assign new rank role (if not 'Unranked')
      if (newRank && newRank !== 'Unranked') {
        console.log('➕ Assigning new rank role', { newRank });
        await this.assignRankRole(member, newRank, guild);
        
        // Also assign ranked #GRNDS role if CHALLENGER I or higher
        const rankValue = this.getRankValue(newRank);
        if (rankValue >= 11) { // CHALLENGER I starts at 11
          await this.assignRankedGrndsRole(member, guild);
        } else {
          // Remove ranked #GRNDS role if below CHALLENGER
          await this.removeRankedGrndsRole(member, guild);
        }
      }

      console.log('✅ Role update completed successfully', {
        userId,
        oldRank,
        newRank,
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Error updating player role', {
        userId,
        oldRank,
        newRank,
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { success: false, message: 'Failed to update role' };
    }
  }

  /**
   * Update Discord role using the player's computed Discord rank from database
   * Useful for multi-game role modes (highest/primary)
   */
  async updatePlayerRoleFromDatabase(
    userId: string,
    guild: Guild
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const player = await this.dbService.getPlayer(userId);
      if (!player || !player.discord_rank) {
        return { success: false, message: 'Player not found or unranked' };
      }

      const member = await guild.members.fetch(userId);
      const currentRank = this.getCurrentRankFromMember(member) || 'Unranked';
      return await this.updatePlayerRole(userId, currentRank, player.discord_rank, guild);
    } catch (error) {
      console.error('Error updating role from database', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, message: 'Failed to update role from database' };
    }
  }

  /**
   * Get the member's current rank role name (best-effort)
   */
  private getCurrentRankFromMember(member: GuildMember): string | null {
    const rankRoles = member.roles.cache.filter((role: Role) => {
      if (!role?.name) return false;
      const roleNameLower = role.name.toLowerCase();
      return RoleUpdateService.RANK_NAMES.some((rn) => roleNameLower.includes(rn));
    });

    if (rankRoles.size === 0) {
      return null;
    }

    let bestRole: Role | null = null;
    for (const role of rankRoles.values()) {
      if (!bestRole || role.position > bestRole.position) {
        bestRole = role;
      }
    }
    return bestRole ? bestRole.name : null;
  }

  /**
   * Remove a rank role from a member
   * Follows guardrails: error handling, logging
   */
  private async removeRankRole(member: GuildMember, oldRank: string, newRank: string, _guild: Guild): Promise<void> {
    try {
      console.log('🔍 Looking for old rank roles to remove', {
        userId: member.id,
        oldRank,
        newRank,
      });

      // Find all rank roles using the standard rank names
      const rolesToRemove = member.roles.cache.filter((role: Role) => {
        if (!role?.name) return false;
        const roleNameLower = role.name.toLowerCase();
        return RoleUpdateService.RANK_NAMES.some((rn) => roleNameLower.includes(rn));
      });

      if (rolesToRemove.size === 0) {
        console.log('ℹ️ No rank roles to remove', {
          userId: member.id,
          currentRoles: member.roles.cache.map(r => r.name),
        });
        return;
      }

      console.log('🗑️ Found rank roles to remove', {
        userId: member.id,
        rolesToRemove: rolesToRemove.map(r => r.name),
      });

      // Remove all matching rank roles
      for (const role of rolesToRemove.values()) {
        try {
          console.log('➖ Removing role', {
            userId: member.id,
            roleId: role.id,
            roleName: role.name,
          });
          await member.roles.remove(role, `Rank updated: ${oldRank} → ${newRank}`);
          console.log('✅ Removed role successfully', {
            userId: member.id,
            roleName: role.name,
          });
        } catch (error) {
          console.error('❌ Failed to remove role', {
            userId: member.id,
            roleId: role.id,
            roleName: role.name,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other roles even if one fails
        }
      }
    } catch (error) {
      console.error('❌ Error removing rank role', {
        userId: member.id,
        oldRank,
        newRank,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Assign a rank role to a member
   * Follows guardrails: error handling, logging, null checks
   */
  private async assignRankRole(member: GuildMember, rank: string, guild: Guild): Promise<void> {
    try {
      console.log('🎯 Searching for rank role', {
        userId: member.id,
        username: member.user.username,
        targetRank: rank,
        guildId: guild.id,
      });

      // Find the exact rank role (case-insensitive exact match)
      const rankRole = guild.roles.cache.find((role: Role) => {
        if (!role?.name) return false;
        const roleName = role.name.toLowerCase().trim();
        const rankLower = rank.toLowerCase().trim();
        // Exact match only (e.g., "grnds v" === "grnds v")
        return roleName === rankLower;
      });

      if (!rankRole) {
        console.error('❌ Rank role not found in server', {
          rank,
          guildId: guild.id,
          guildName: guild.name,
          searchedFor: rank.toLowerCase().trim(),
          totalRoles: guild.roles.cache.size,
        });
        return;
      }

      console.log('✅ Found rank role', {
        roleId: rankRole.id,
        roleName: rankRole.name,
        roleColor: rankRole.hexColor,
        rolePosition: rankRole.position,
      });

      // Check if member already has this role
      if (member.roles.cache.has(rankRole.id)) {
        console.log('ℹ️ Member already has this role', {
          userId: member.id,
          roleName: rankRole.name,
        });
        return;
      }

      // Assign the role
      console.log('🎭 Adding role to member', {
        userId: member.id,
        username: member.user.username,
        roleId: rankRole.id,
        roleName: rankRole.name,
      });

      await member.roles.add(rankRole, `Rank updated to ${rank}`);

      console.log('✅ Successfully assigned rank role', {
        userId: member.id,
        username: member.user.username,
        roleName: rankRole.name,
        currentRoles: member.roles.cache.map(r => r.name),
      });
    } catch (error) {
      console.error('❌ Error assigning rank role', {
        userId: member.id,
        rank,
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Assign ranked #GRNDS role to players who are CHALLENGER I or higher
   */
  private async assignRankedGrndsRole(member: GuildMember, guild: Guild): Promise<void> {
    try {
      const rankedGrndsRole = guild.roles.cache.find(
        (role) => role.name === '#GRNDS' || role.name === 'ranked #GRNDS' || role.name.toLowerCase().includes('ranked grnds')
      );

      if (!rankedGrndsRole) {
        console.warn('⚠️ Ranked #GRNDS role not found in guild', { guildId: guild.id, guildName: guild.name });
        return;
      }

      if (member.roles.cache.has(rankedGrndsRole.id)) {
        console.log('ℹ️ Member already has ranked #GRNDS role', { userId: member.id });
        return;
      }

      await member.roles.add(rankedGrndsRole, 'Reached CHALLENGER I or higher');
      console.log('✅ Assigned ranked #GRNDS role', { userId: member.id, username: member.user.username });
    } catch (error) {
      console.error('❌ Error assigning ranked #GRNDS role', {
        userId: member.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Remove ranked #GRNDS role from players below CHALLENGER I
   */
  private async removeRankedGrndsRole(member: GuildMember, guild: Guild): Promise<void> {
    try {
      const rankedGrndsRole = guild.roles.cache.find(
        (role) => role.name === '#GRNDS' || role.name === 'ranked #GRNDS' || role.name.toLowerCase().includes('ranked grnds')
      );

      if (!rankedGrndsRole) {
        return; // Role doesn't exist, nothing to remove
      }

      if (!member.roles.cache.has(rankedGrndsRole.id)) {
        return; // Member doesn't have the role
      }

      await member.roles.remove(rankedGrndsRole, 'Ranked below CHALLENGER I');
      console.log('✅ Removed ranked #GRNDS role', { userId: member.id, username: member.user.username });
    } catch (error) {
      console.error('❌ Error removing ranked #GRNDS role', {
        userId: member.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send rank-up notification to a channel (optional)
   * Can be called after successful role update
   */
  async sendRankUpNotification(
    userId: string,
    oldRank: string,
    newRank: string,
    channelId: string,
    guild: Guild
  ): Promise<boolean> {
    try {
      const channel = await guild.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        return false;
      }

      const member = await guild.members.fetch(userId);
      const isRankUp = this.isRankUp(oldRank, newRank);

      if (isRankUp) {
        await channel.send({
          content: `🎉 **${member.displayName}** ranked up from **${oldRank}** to **${newRank}**!`,
        });
      }

      return true;
    } catch (error) {
      console.error('Error sending rank-up notification', {
        userId,
        oldRank,
        newRank,
        channelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if rank change is a rank-up (higher rank value)
   */
  private isRankUp(oldRank: string, newRank: string): boolean {
    const oldValue = this.getRankValue(oldRank);
    const newValue = this.getRankValue(newRank);
    return newValue > oldValue;
  }

  /**
   * Get numeric value for a rank (for comparison)
   */
  private getRankValue(rank: string): number {
    const rankMap: Record<string, number> = {
      'Unranked': 0,
      'GRNDS I': 1,
      'GRNDS II': 2,
      'GRNDS III': 3,
      'GRNDS IV': 4,
      'GRNDS V': 5,
      'BREAKPOINT I': 6,
      'BREAKPOINT II': 7,
      'BREAKPOINT III': 8,
      'BREAKPOINT IV': 9,
      'BREAKPOINT V': 10,
      'CHALLENGER I': 11,
      'CHALLENGER II': 12,
      'CHALLENGER III': 13,
      'ABSOLUTE': 14,
      'X': 15,
    };
    return rankMap[rank] || 0;
  }

  /**
   * Remove all rank roles from a member
   * Used when unlinking account
   */
  async removeAllRankRoles(userId: string, guild: Guild): Promise<void> {
    try {
      console.log('🗑️ Removing all rank roles from member', {
        userId,
        guildId: guild.id,
      });

      const member = await guild.members.fetch(userId);
      if (!member) {
        console.warn('⚠️ Member not found when trying to remove rank roles', { userId });
        return;
      }

      const rolesToRemove = member.roles.cache.filter((role: Role) => {
        if (!role?.name) return false;
        const roleNameLower = role.name.toLowerCase();
        return RoleUpdateService.RANK_NAMES.some((rn) => roleNameLower.includes(rn));
      });

      if (rolesToRemove.size === 0) {
        console.log('ℹ️ No rank roles to remove', { userId });
        return;
      }

      console.log('🗑️ Removing rank roles', {
        userId,
        roles: rolesToRemove.map(r => r.name),
      });

      for (const role of rolesToRemove.values()) {
        try {
          await member.roles.remove(role, 'Account unlinked');
          console.log('✅ Removed role', {
            userId,
            roleName: role.name,
          });
        } catch (error) {
          console.error('❌ Failed to remove role', {
            userId,
            roleName: role.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      console.error('❌ Error removing all rank roles', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if member has a rank role
   */
  async hasRankRole(userId: string, guild: Guild): Promise<boolean> {
    try {
      const member = await guild.members.fetch(userId);
      if (!member) return false;

      return member.roles.cache.some((role: Role) => {
        if (!role?.name) return false;
        const roleNameLower = role.name.toLowerCase();
        return RoleUpdateService.RANK_NAMES.some((rn) => roleNameLower.includes(rn));
      });
    } catch (error) {
      console.error('Error checking rank role', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
