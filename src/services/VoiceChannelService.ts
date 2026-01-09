import { Guild, VoiceChannel, Role, ChannelType, PermissionOverwriteOptions } from 'discord.js';
import { Match } from '../models/Match';

/**
 * Service for managing voice channels and team assignments
 * Follows guardrails: error handling, logging, type safety
 */
export class VoiceChannelService {
  /**
   * Create queue lobby voice channel
   * Follows guardrails: error handling, validation
   */
  async createQueueLobby(
    guild: Guild,
    categoryName: string = 'Match Lobbies'
  ): Promise<VoiceChannel | null> {
    try {
      if (!guild) {
        console.error('Invalid guild for queue lobby creation');
        return null;
      }

      // Get or create category
      const category = await this.getOrCreateCategory(guild, categoryName);

      // Check if queue lobby already exists
      const existing = guild.channels.cache.find(
        (ch: any) => ch.type === ChannelType.GuildVoice && ch.name === '🎮 Queue Lobby'
      ) as VoiceChannel | undefined;

      if (existing) {
        return existing;
      }

      // Create queue lobby voice channel
      const channel = await guild.channels.create({
        name: '🎮 Queue Lobby',
        type: ChannelType.GuildVoice,
        parent: category.id,
        userLimit: 10, // Max 10 players
      });

      return channel as VoiceChannel;
    } catch (error) {
      console.error('Error creating queue lobby', {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Move user to queue lobby
   * Follows guardrails: error handling
   */
  async moveToQueueLobby(
    guild: Guild,
    userId: string,
    queueLobbyChannel: VoiceChannel | null
  ): Promise<boolean> {
    try {
      if (!queueLobbyChannel) {
        return false;
      }

      const member = await guild.members.fetch(userId);
      
      // Only move if they're in a voice channel (can't force move if not in VC)
      // Discord limitation: can only move users who are already in a voice channel
      if (member.voice.channel) {
        await member.voice.setChannel(queueLobbyChannel, 'Joined queue');
        return true;
      }

      // User not in VC - can't force move (Discord API limitation)
      return false;
    } catch (error) {
      console.error('Error moving user to queue lobby', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Create voice channels for teams and assign users
   * Moves users from queue lobby to team channels
   * Follows guardrails: error handling, validation
   */
  async setupTeamVoiceChannels(
    guild: Guild,
    match: Match,
    categoryName: string = 'Match Lobbies',
    queueLobbyChannel?: VoiceChannel | null
  ): Promise<{ teamAChannel: VoiceChannel | null; teamBChannel: VoiceChannel | null }> {
    try {
      // Validate inputs
      if (!guild) {
        console.error('Invalid guild for voice channel setup');
        return { teamAChannel: null, teamBChannel: null };
      }

      // Get or create category
      const category = await this.getOrCreateCategory(guild, categoryName);

      // Create team roles if they don't exist
      const teamARole = await this.getOrCreateTeamRole(guild, 'Team A', 0x3498db); // Blue
      const teamBRole = await this.getOrCreateTeamRole(guild, 'Team B', 0xe74c3c); // Red

      // Create voice channels
      const teamAChannel = await this.createTeamVoiceChannel(
        guild,
        category,
        `🔵 Team A - ${match.map}`,
        teamARole
      );

      const teamBChannel = await this.createTeamVoiceChannel(
        guild,
        category,
        `🔴 Team B - ${match.map}`,
        teamBRole
      );

      // Assign team roles and move users to voice channels
      await this.assignTeamRolesAndMoveUsers(
        guild,
        match,
        teamARole,
        teamBRole,
        teamAChannel,
        teamBChannel,
        queueLobbyChannel
      );

      return { teamAChannel, teamBChannel };
    } catch (error) {
      console.error('Error setting up team voice channels', {
        guildId: guild.id,
        matchId: match.matchId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { teamAChannel: null, teamBChannel: null };
    }
  }

  /**
   * Get or create category for match channels
   * Follows guardrails: error handling
   */
  private async getOrCreateCategory(guild: Guild, categoryName: string): Promise<any> {
    try {
      // Try to find existing category
      const existing = guild.channels.cache.find(
        (ch: any) => ch.type === ChannelType.GuildCategory && ch.name === categoryName
      );

      if (existing) {
        return existing;
      }

      // Create new category
      const category = await guild.channels.create({
        name: categoryName,
        type: ChannelType.GuildCategory,
      });

      return category;
    } catch (error) {
      console.error('Error getting/creating category', {
        guildId: guild.id,
        categoryName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get or create team role
   * Follows guardrails: error handling
   */
  private async getOrCreateTeamRole(guild: Guild, roleName: string, color: number): Promise<Role> {
    try {
      // Try to find existing role
      const existing = guild.roles.cache.find((role: Role) => role.name === roleName);

      if (existing) {
        return existing;
      }

      // Create new role
      const role = await guild.roles.create({
        name: roleName,
        color,
        mentionable: true,
      });

      return role;
    } catch (error) {
      console.error('Error getting/creating team role', {
        guildId: guild.id,
        roleName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create team voice channel with permissions
   * Follows guardrails: error handling
   */
  private async createTeamVoiceChannel(
    guild: Guild,
    category: any,
    channelName: string,
    teamRole: Role
  ): Promise<VoiceChannel | null> {
    try {
      // Permissions: Only team role can connect
      const permissions: PermissionOverwriteOptions = {
        Connect: true,
        Speak: true,
        ViewChannel: true,
      };

      const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: ['Connect', 'ViewChannel'] as any,
          },
          {
            id: teamRole.id,
            allow: permissions as any,
          },
        ],
      });

      return channel as VoiceChannel;
    } catch (error) {
      console.error('Error creating team voice channel', {
        guildId: guild.id,
        channelName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Assign team roles and move users to voice channels
   * Follows guardrails: error handling, null checks
   */
  private async assignTeamRolesAndMoveUsers(
    guild: Guild,
    match: Match,
    teamARole: Role,
    teamBRole: Role,
    teamAChannel: VoiceChannel | null,
    teamBChannel: VoiceChannel | null,
    queueLobbyChannel?: VoiceChannel | null
  ): Promise<void> {
    try {
      // Assign Team A roles and move to voice channel
      for (const player of match.teams.teamA.players) {
        try {
          const member = await guild.members.fetch(player.userId);
          
          // Remove other team role if exists
          if (member.roles.cache.has(teamBRole.id)) {
            await member.roles.remove(teamBRole, 'Assigned to Team A');
          }

          // Add Team A role
          if (!member.roles.cache.has(teamARole.id)) {
            await member.roles.add(teamARole, 'Assigned to Team A');
          }

          // Move to Team A voice channel
          // Try to move from queue lobby, or if they're already in a VC
          if (teamAChannel) {
            const isInQueueLobby = queueLobbyChannel && member.voice.channel?.id === queueLobbyChannel.id;
            if (isInQueueLobby || member.voice.channel) {
              // Move from queue lobby or any other VC
              await member.voice.setChannel(teamAChannel, 'Assigned to Team A');
            } else {
              // Player not in VC - send DM prompt
              try {
                await member.send(
                  `🎮 You've been assigned to **Team A**!\n\n` +
                  `Please join your team voice channel: <#${teamAChannel.id}>\n` +
                  `You've been given the **Team A** role.`
                );
              } catch (error) {
                // DM failed (user has DMs disabled) - log but continue
                console.warn('Could not send VC prompt DM to Team A player', {
                  userId: player.userId,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
        } catch (error) {
          console.error('Error assigning Team A role/moving user', {
            userId: player.userId,
            username: player.username,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with next player
        }
      }

      // Assign Team B roles and move to voice channel
      for (const player of match.teams.teamB.players) {
        try {
          const member = await guild.members.fetch(player.userId);
          
          // Remove other team role if exists
          if (member.roles.cache.has(teamARole.id)) {
            await member.roles.remove(teamARole, 'Assigned to Team B');
          }

          // Add Team B role
          if (!member.roles.cache.has(teamBRole.id)) {
            await member.roles.add(teamBRole, 'Assigned to Team B');
          }

          // Move to Team B voice channel
          // Try to move from queue lobby, or if they're already in a VC
          if (teamBChannel) {
            const isInQueueLobby = queueLobbyChannel && member.voice.channel?.id === queueLobbyChannel.id;
            if (isInQueueLobby || member.voice.channel) {
              // Move from queue lobby or any other VC
              await member.voice.setChannel(teamBChannel, 'Assigned to Team B');
            } else {
              // Player not in VC - send DM prompt
              try {
                await member.send(
                  `🎮 You've been assigned to **Team B**!\n\n` +
                  `Please join your team voice channel: <#${teamBChannel.id}>\n` +
                  `You've been given the **Team B** role.`
                );
              } catch (error) {
                // DM failed (user has DMs disabled) - log but continue
                console.warn('Could not send VC prompt DM to Team B player', {
                  userId: player.userId,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
          }
        } catch (error) {
          console.error('Error assigning Team B role/moving user', {
            userId: player.userId,
            username: player.username,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue with next player
        }
      }
    } catch (error) {
      console.error('Error assigning team roles and moving users', {
        matchId: match.matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - partial success is better than complete failure
    }
  }

  /**
   * Clean up voice channels and team roles after match
   * Follows guardrails: error handling
   */
  async cleanupTeamChannels(
    guild: Guild,
    _teamAChannel: VoiceChannel | null,
    _teamBChannel: VoiceChannel | null
  ): Promise<void> {
    try {
      // Remove team roles from all members
      const teamARole = guild.roles.cache.find((r: Role) => r.name === 'Team A');
      const teamBRole = guild.roles.cache.find((r: Role) => r.name === 'Team B');

      if (teamARole) {
        for (const member of teamARole.members.values()) {
          try {
            await member.roles.remove(teamARole, 'Match ended');
          } catch (error) {
            console.error('Error removing Team A role', {
              userId: member.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      if (teamBRole) {
        for (const member of teamBRole.members.values()) {
          try {
            await member.roles.remove(teamBRole, 'Match ended');
          } catch (error) {
            console.error('Error removing Team B role', {
              userId: member.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Delete voice channels (optional - you might want to keep them)
      // Uncomment if you want to delete channels after match
      /*
      if (teamAChannel) {
        try {
          await teamAChannel.delete('Match ended');
        } catch (error) {
          console.error('Error deleting Team A channel', { error });
        }
      }

      if (teamBChannel) {
        try {
          await teamBChannel.delete('Match ended');
        } catch (error) {
          console.error('Error deleting Team B channel', { error });
        }
      }
      */
    } catch (error) {
      console.error('Error cleaning up team channels', {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cleanup is non-critical
    }
  }
}
