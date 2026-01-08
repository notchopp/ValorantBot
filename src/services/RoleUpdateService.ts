import { GuildMember, Role, Guild } from 'discord.js';
import { DatabaseService } from './DatabaseService';
import { Config } from '../config/config';

/**
 * Service for automatically updating Discord roles based on rank changes
 * Follows guardrails: error handling, logging, type safety
 */
export class RoleUpdateService {
  constructor(_dbService: DatabaseService, _config: Config) {
    // Services stored for future use (logging, config access)
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
      // Validate inputs
      if (!userId || !guild) {
        console.error('Invalid inputs for role update', {
          userId,
          guildId: guild?.id,
        });
        return { success: false, message: 'Invalid inputs' };
      }

      // Get guild member
      let member: GuildMember;
      try {
        member = await guild.members.fetch(userId);
      } catch (error) {
        console.error('Failed to fetch guild member', {
          userId,
          guildId: guild.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return { success: false, message: 'Member not found in guild' };
      }

      // Remove old rank role (if exists and not 'Unranked')
      if (oldRank && oldRank !== 'Unranked') {
        await this.removeRankRole(member, oldRank, newRank, guild);
      }

      // Assign new rank role (if not 'Unranked')
      if (newRank && newRank !== 'Unranked') {
        await this.assignRankRole(member, newRank, guild);
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating player role', {
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
   * Remove a rank role from a member
   * Follows guardrails: error handling, logging
   */
  private async removeRankRole(member: GuildMember, oldRank: string, newRank: string, _guild: Guild): Promise<void> {
    try {
      // Find all rank roles that match the old rank
      const rankNames = ['grnds', 'breakpoint', 'challenger', 'x'];
      const rolesToRemove = member.roles.cache.filter((role: Role) => {
        const roleNameLower = role.name.toLowerCase();
        return rankNames.some((rn) => roleNameLower.includes(rn));
      });

      if (rolesToRemove.size === 0) {
        // No rank role to remove - this is fine
        return;
      }

      // Remove all matching rank roles
      for (const role of rolesToRemove.values()) {
        try {
          await member.roles.remove(role, `Rank updated: ${oldRank} → ${newRank}`);
        } catch (error) {
          console.error('Failed to remove role', {
            userId: member.id,
            roleId: role.id,
            roleName: role.name,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with other roles even if one fails
        }
      }
    } catch (error) {
      console.error('Error removing rank role', {
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
      // Find the exact rank role
      const rankRole = guild.roles.cache.find((role: Role) => {
        if (!role || !role.name) return false;
        const roleName = role.name.toLowerCase();
        const rankLower = rank.toLowerCase();
        // Match exact rank (e.g., "GRNDS V" matches role "GRNDS V")
        return roleName === rankLower || roleName.includes(rankLower.split(' ')[0]);
      });

      if (!rankRole) {
        console.warn('Rank role not found in server', {
          rank,
          guildId: guild.id,
          availableRoles: guild.roles.cache.map((r: Role) => r.name).slice(0, 10),
        });
        return;
      }

      // Check if member already has this role
      if (member.roles.cache.has(rankRole.id)) {
        // Already has the role - no need to add
        return;
      }

      // Assign the role
      await member.roles.add(rankRole, `Rank updated to ${rank}`);
    } catch (error) {
      console.error('Error assigning rank role', {
        userId: member.id,
        rank,
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - this is a non-critical operation
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
      'CHALLENGER IV': 14,
      'CHALLENGER V': 15,
      'X': 16,
    };
    return rankMap[rank] || 0;
  }
}
