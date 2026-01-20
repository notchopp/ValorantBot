import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { QueueService } from './QueueService';
import { DatabaseService } from './DatabaseService';
import { Config } from '../config/config';

/**
 * Service to maintain a persistent queue message in the lobby channel
 * This message is always available for players to join the queue
 */
export class PersistentQueueService {
  private persistentMessageId: string | null = null;
  private persistentChannelId: string | null = null;

  constructor(
    private client: Client,
    private queueService: QueueService,
    private databaseService: DatabaseService,
    private config: Config
  ) {}

  /**
   * Initialize or update the persistent queue message in the lobby channel
   */
  async initializePersistentQueue(lobbyChannelName: string = 'lobby'): Promise<void> {
    try {
      // Find the lobby channel
      const guilds = this.client.guilds.cache;
      let lobbyChannel: TextChannel | null = null;

      for (const guild of guilds.values()) {
        const channel = guild.channels.cache.find(
          (ch) => ch.isTextBased() && (ch.name.toLowerCase().includes(lobbyChannelName.toLowerCase()) || ch.name.toLowerCase() === 'lobby℗')
        ) as TextChannel | undefined;

        if (channel) {
          lobbyChannel = channel as TextChannel;
          break;
        }
      }

      if (!lobbyChannel) {
        console.warn('⚠️ Lobby channel not found, persistent queue will not be created');
        return;
      }

      // Check if there's already a persistent message
      const existingMessages = await lobbyChannel.messages.fetch({ limit: 50 });
      const existingQueueMessage = existingMessages.find(
        (msg) => msg.author.id === this.client.user?.id && msg.embeds[0]?.footer?.text?.includes('Persistent Queue')
      );

      if (existingQueueMessage) {
        this.persistentMessageId = existingQueueMessage.id;
        this.persistentChannelId = lobbyChannel.id;
        console.log('✅ Found existing persistent queue message', { messageId: this.persistentMessageId });
        // Update it
        await this.updatePersistentQueueMessage();
        return;
      }

      // Create new persistent queue message
      const embed = await this.createPersistentQueueEmbed();
      const buttons = this.createQueueButtons();

      const message = await lobbyChannel.send({
        embeds: [embed],
        components: [buttons],
      });

      this.persistentMessageId = message.id;
      this.persistentChannelId = lobbyChannel.id;

      console.log('✅ Created persistent queue message', {
        messageId: this.persistentMessageId,
        channelId: this.persistentChannelId,
      });
    } catch (error) {
      console.error('❌ Error initializing persistent queue', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update the persistent queue message with current queue status
   */
  async updatePersistentQueueMessage(): Promise<void> {
    if (!this.persistentMessageId || !this.persistentChannelId) {
      return;
    }

    try {
      const channel = (await this.client.channels.fetch(this.persistentChannelId)) as TextChannel;
      if (!channel) {
        console.warn('⚠️ Persistent queue channel not found');
        return;
      }

      const message = await channel.messages.fetch(this.persistentMessageId);
      if (!message) {
        console.warn('⚠️ Persistent queue message not found, recreating...');
        await this.initializePersistentQueue();
        return;
      }

      const embed = await this.createPersistentQueueEmbed();
      const buttons = this.createQueueButtons();

      await message.edit({
        embeds: [embed],
        components: [buttons],
      });
    } catch (error) {
      console.error('❌ Error updating persistent queue message', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create the embed for the persistent queue message
   */
  private async createPersistentQueueEmbed(): Promise<EmbedBuilder> {
    const queueStatus = this.queueService.getCurrentQueueSizeSync();
    const maxPlayers = this.config.queue.maxPlayers;

    // Find #GRNDSMAKER role for mention
    let grndsMakerMention = '#GRNDSMAKER';
    try {
      const guilds = this.client.guilds.cache;
      for (const guild of guilds.values()) {
        const role = guild.roles.cache.find(
          (r) => r.name === '#GRNDSMAKER'
        );
        if (role) {
          grndsMakerMention = `<@&${role.id}>`;
          break;
        }
      }
    } catch (error) {
      // Fallback to text if role not found
    }

    const embed = new EmbedBuilder()
      .setTitle('Queue is Always Open!')
      .setDescription(
        '**Anyone can join the queue!** Click the button below or use `/queue join`\n\n' +
        `**Need a new queue started?** Ping ${grndsMakerMention} or any mod!\n` +
        '**#GRNDSMAKER** control queues - they\'re given to consistent active players to start queues at any time.'
      )
      .setColor(0x00ff00)
      .addFields({
        name: 'Players in Queue',
        value: `${queueStatus}/${maxPlayers}`,
        inline: true,
      })
      .addFields({
        name: 'Status',
        value: queueStatus >= maxPlayers ? 'Full' : 'Open',
        inline: true,
      });

    // Get queue players with their rank and MMR
    try {
      const players = await this.databaseService.getQueuePlayersWithData();
      
      if (players.length > 0) {
        const activeGame = players[0].preferred_game === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant';
        embed.addFields({
          name: 'Game',
          value: activeGame,
          inline: true,
        });

        const playerList = players
          .slice(0, 10) // Show first 10 players
          .map((p, index) => {
            const isMarvel = p.preferred_game === 'marvel_rivals';
            const rank = isMarvel
              ? (p.marvel_rivals_rank || 'Unranked')
              : (p.valorant_rank || p.discord_rank || 'Unranked');
            const mmr = isMarvel
              ? (p.marvel_rivals_mmr || 0)
              : (p.valorant_mmr || p.current_mmr || 0);
            return `${index + 1}. <@${p.discord_user_id}> - ${rank} (${mmr} MMR)`;
          })
          .join('\n');

        embed.addFields({
          name: 'In Queue',
          value: playerList || 'None',
          inline: false,
        });
      }
    } catch (error) {
      console.error('Error fetching queue players for persistent queue', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue without player list if there's an error
    }

    embed.setFooter({ text: 'Persistent Queue • Always available • Use /queue start to create a new queue' });

    return embed;
  }

  /**
   * Create the buttons for the persistent queue message
   */
  private createQueueButtons(): ActionRowBuilder<ButtonBuilder> {
    const joinButton = new ButtonBuilder()
      .setCustomId('queue_join_button')
      .setLabel('Join Queue')
      .setStyle(ButtonStyle.Primary);

    const leaveButton = new ButtonBuilder()
      .setCustomId('queue_leave_button')
      .setLabel('Leave Queue')
      .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton);
  }

  /**
   * Get the persistent message ID and channel ID
   */
  getPersistentQueueInfo(): { messageId: string | null; channelId: string | null } {
    return {
      messageId: this.persistentMessageId,
      channelId: this.persistentChannelId,
    };
  }
}
