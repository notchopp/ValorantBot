import { Guild, VoiceChannel, Role, ChannelType, PermissionOverwriteOptions, Client } from 'discord.js';
import { Match } from '../models/Match';

/**
 * Service for managing voice channels and team assignments
 * Follows guardrails: error handling, logging, type safety
 */
export class VoiceChannelService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
  private readonly CHANNEL_MAX_AGE_MS = 30 * 60 * 1000; // Delete empty channels after 30 minutes
  private client: Client | null = null;

  /**
   * Start automatic voice channel cleanup service
   */
  startCleanupService(client: Client): void {
    if (this.cleanupInterval) {
      console.warn('Voice channel cleanup service already running');
      return;
    }

    this.client = client;
    console.log('Starting voice channel cleanup service', {
      checkInterval: `${this.CLEANUP_INTERVAL_MS / 1000 / 60} minutes`,
      maxAge: `${this.CHANNEL_MAX_AGE_MS / 1000 / 60} minutes`,
    });

    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleChannels();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop automatic voice channel cleanup service
   */
  stopCleanupService(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Voice channel cleanup service stopped');
    }
  }

  /**
   * Clean up stale/empty team voice channels across all guilds
   */
  private async cleanupStaleChannels(): Promise<void> {
    if (!this.client) return;

    try {
      for (const [, guild] of this.client.guilds.cache) {
        await this.cleanupGuildChannels(guild);
      }
    } catch (error) {
      console.error('Error in voice channel cleanup', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clean up stale team channels in a specific guild
   */
  private async cleanupGuildChannels(guild: Guild): Promise<void> {
    try {
      // Find team voice channels (match pattern: "🔵 VAL Team A" or "🔴 MR Team B" etc)
      const teamChannels = guild.channels.cache.filter((ch: any) => {
        if (ch.type !== ChannelType.GuildVoice) return false;
        const name = ch.name || '';
        return (name.includes('Team A') || name.includes('Team B')) && 
               (name.startsWith('🔵') || name.startsWith('🔴'));
      });

      for (const [, channel] of teamChannels) {
        const voiceChannel = channel as VoiceChannel;
        
        // Skip if channel has members
        if (voiceChannel.members.size > 0) continue;

        // Check channel age (created time)
        const channelAge = Date.now() - voiceChannel.createdTimestamp;
        
        // Delete if empty and older than threshold
        if (channelAge > this.CHANNEL_MAX_AGE_MS) {
          try {
            await voiceChannel.delete('Automatic cleanup - empty team channel');
            console.log('Cleaned up stale voice channel', {
              channelName: voiceChannel.name,
              guildName: guild.name,
              ageMinutes: Math.round(channelAge / 1000 / 60),
            });
          } catch (error) {
            console.error('Error deleting stale channel', {
              channelId: voiceChannel.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up guild channels', {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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

      // Format game name for display
      const gameLabel = match.gameType === 'marvel_rivals' ? 'MR' : 'VAL';

      // Create voice channels with game label
      const teamAChannel = await this.createTeamVoiceChannel(
        guild,
        category,
        `🔵 ${gameLabel} Team A - ${match.map}`,
        teamARole
      );

      const teamBChannel = await this.createTeamVoiceChannel(
        guild,
        category,
        `🔴 ${gameLabel} Team B - ${match.map}`,
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
    teamAChannel: VoiceChannel | null,
    teamBChannel: VoiceChannel | null,
    deleteChannels: boolean = true
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

      // Delete voice channels if requested
      if (deleteChannels) {
        if (teamAChannel) {
          try {
            // Only delete if channel is empty
            if (teamAChannel.members.size === 0) {
              await teamAChannel.delete('Match ended - cleanup');
              console.log('Deleted Team A voice channel', { channelName: teamAChannel.name });
            } else {
              console.log('Team A channel still has members, skipping deletion', { 
                memberCount: teamAChannel.members.size 
              });
            }
          } catch (error) {
            console.error('Error deleting Team A channel', { 
              error: error instanceof Error ? error.message : String(error) 
            });
          }
        }

        if (teamBChannel) {
          try {
            // Only delete if channel is empty
            if (teamBChannel.members.size === 0) {
              await teamBChannel.delete('Match ended - cleanup');
              console.log('Deleted Team B voice channel', { channelName: teamBChannel.name });
            } else {
              console.log('Team B channel still has members, skipping deletion', { 
                memberCount: teamBChannel.members.size 
              });
            }
          } catch (error) {
            console.error('Error deleting Team B channel', { 
              error: error instanceof Error ? error.message : String(error) 
            });
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up team channels', {
        guildId: guild.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw - cleanup is non-critical
    }
  }
}
