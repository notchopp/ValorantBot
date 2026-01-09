import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { PlayerService } from './PlayerService';
import { getKD, getWinRate } from '../models/Player';

/**
 * Service to maintain a persistent leaderboard message in the leaderboard channel
 * This message always shows the top 15 players with detailed competitive stats
 */
export class PersistentLeaderboardService {
  private persistentMessageId: string | null = null;
  private persistentChannelId: string | null = null;

  constructor(
    private client: Client,
    private playerService: PlayerService
  ) {}

  /**
   * Initialize or update the persistent leaderboard message in the leaderboard channel
   */
  async initializePersistentLeaderboard(leaderboardChannelName: string = 'leaderboard'): Promise<void> {
    try {
      // Find the leaderboard channel
      const guilds = this.client.guilds.cache;
      let leaderboardChannel: TextChannel | null = null;

      for (const guild of guilds.values()) {
        const channel = guild.channels.cache.find(
          (ch) => ch.isTextBased() && ch.name.toLowerCase().includes(leaderboardChannelName.toLowerCase())
        ) as TextChannel | undefined;

        if (channel) {
          leaderboardChannel = channel as TextChannel;
          break;
        }
      }

      if (!leaderboardChannel) {
        console.warn('⚠️ Leaderboard channel not found, persistent leaderboard will not be created');
        return;
      }

      // Check if there's already a persistent message
      const existingMessages = await leaderboardChannel.messages.fetch({ limit: 50 });
      const existingLeaderboardMessage = existingMessages.find(
        (msg) => msg.author.id === this.client.user?.id && msg.embeds[0]?.footer?.text?.includes('Persistent Leaderboard')
      );

      if (existingLeaderboardMessage) {
        this.persistentMessageId = existingLeaderboardMessage.id;
        this.persistentChannelId = leaderboardChannel.id;
        console.log('✅ Found existing persistent leaderboard message', { messageId: this.persistentMessageId });
        // Update it
        await this.updatePersistentLeaderboardMessage();
        return;
      }

      // Create new persistent leaderboard message
      const embed = await this.createPersistentLeaderboardEmbed();

      const message = await leaderboardChannel.send({
        embeds: [embed],
      });

      this.persistentMessageId = message.id;
      this.persistentChannelId = leaderboardChannel.id;

      console.log('✅ Created persistent leaderboard message', {
        messageId: this.persistentMessageId,
        channelId: this.persistentChannelId,
      });
    } catch (error) {
      console.error('❌ Error initializing persistent leaderboard', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update the persistent leaderboard message with current top players
   */
  async updatePersistentLeaderboardMessage(): Promise<void> {
    if (!this.persistentMessageId || !this.persistentChannelId) {
      return;
    }

    try {
      const channel = (await this.client.channels.fetch(this.persistentChannelId)) as TextChannel;
      if (!channel) {
        console.warn('⚠️ Persistent leaderboard channel not found');
        return;
      }

      const message = await channel.messages.fetch(this.persistentMessageId);
      if (!message) {
        console.warn('⚠️ Persistent leaderboard message not found, recreating...');
        await this.initializePersistentLeaderboard();
        return;
      }

      const embed = await this.createPersistentLeaderboardEmbed();

      await message.edit({
        embeds: [embed],
      });
    } catch (error) {
      console.error('❌ Error updating persistent leaderboard message', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create the embed for the persistent leaderboard message
   */
  private async createPersistentLeaderboardEmbed(): Promise<EmbedBuilder> {
    const topPlayers = await this.playerService.getTopPlayersByPoints(15);

    const embed = new EmbedBuilder()
      .setTitle('Top 15 Players')
      .setDescription('Ranked by MMR • Updates automatically after each match')
      .setColor(0xffd700)
      .setFooter({ text: 'Persistent Leaderboard • See full leaderboard: /leaderboard or grnds.xyz/leaderboard' });

    if (topPlayers.length === 0) {
      embed.addFields({
        name: 'No Players Yet',
        value: 'Join a queue and play matches to appear on the leaderboard!',
        inline: false,
      });
      return embed;
    }

    // Format detailed leaderboard entries with competitive stats
    const leaderboardEntries = topPlayers.map((player, index) => {
      const position = index + 1;
      const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
      const rank = player.rank || 'Unranked';
      const mmr = player.stats.points || 0;
      const username = player.username || 'Unknown';
      const kd = getKD(player);
      const winRate = getWinRate(player);
      const wins = player.stats.wins || 0;
      const losses = player.stats.losses || 0;

      // Format: Position | Username | Rank | MMR | K/D | W-L (Win%)
      return `${medal} **${username}** | ${rank} | ${mmr} MMR | ${kd.toFixed(2)} K/D | ${wins}W-${losses}L (${winRate}%)`;
    });

    // Split into chunks if needed (Discord embed field value limit is 1024 characters)
    const leaderboardText = leaderboardEntries.join('\n');
    
    if (leaderboardText.length <= 1024) {
      embed.addFields({
        name: 'Leaderboard',
        value: leaderboardText,
        inline: false,
      });
    } else {
      // Split into multiple fields if too long
      const chunkSize = Math.ceil(leaderboardEntries.length / 2);
      const firstChunk = leaderboardEntries.slice(0, chunkSize).join('\n');
      const secondChunk = leaderboardEntries.slice(chunkSize).join('\n');

      embed.addFields(
        {
          name: 'Top Players',
          value: firstChunk,
          inline: false,
        },
        {
          name: 'Continued',
          value: secondChunk,
          inline: false,
        }
      );
    }

    return embed;
  }

  /**
   * Get the persistent message ID and channel ID
   */
  getPersistentLeaderboardInfo(): { messageId: string | null; channelId: string | null } {
    return {
      messageId: this.persistentMessageId,
      channelId: this.persistentChannelId,
    };
  }
}
