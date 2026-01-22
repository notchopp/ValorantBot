import { Client, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { QueueService } from './QueueService';
import { DatabaseService } from './DatabaseService';

/**
 * Service to maintain a persistent queue message in the lobby channel
 * This message is always available for players to join the queue
 */
export class PersistentQueueService {
  private persistentMessages: Record<'valorant' | 'marvel_rivals', { messageId: string | null; channelId: string | null }> = {
    valorant: { messageId: null, channelId: null },
    marvel_rivals: { messageId: null, channelId: null },
  };

  constructor(
    private client: Client,
    private queueService: QueueService,
    private databaseService: DatabaseService
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
      await this.initializePersistentQueueForGame(lobbyChannel, existingMessages, 'valorant');
      await this.initializePersistentQueueForGame(lobbyChannel, existingMessages, 'marvel_rivals');
    } catch (error) {
      console.error('❌ Error initializing persistent queue', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update the persistent queue message with current queue status
   */
  async updatePersistentQueueMessage(game?: 'valorant' | 'marvel_rivals'): Promise<void> {
    const games = game ? [game] : (['valorant', 'marvel_rivals'] as const);

    try {
      for (const targetGame of games) {
        const { messageId, channelId } = this.persistentMessages[targetGame];
        if (!messageId || !channelId) {
          continue;
        }

        const channel = (await this.client.channels.fetch(channelId)) as TextChannel;
        if (!channel) {
          console.warn('⚠️ Persistent queue channel not found', { game: targetGame });
          continue;
        }

        const message = await channel.messages.fetch(messageId);
        if (!message) {
          console.warn('⚠️ Persistent queue message not found, recreating...', { game: targetGame });
          await this.initializePersistentQueue();
          return;
        }

        const embed = await this.createPersistentQueueEmbed(targetGame);
        const buttons = this.createQueueButtons(targetGame);

        await message.edit({
          embeds: [embed],
          components: [buttons],
        });
      }
    } catch (error) {
      console.error('❌ Error updating persistent queue message', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Create the embed for the persistent queue message
   */
  private async createPersistentQueueEmbed(game: 'valorant' | 'marvel_rivals'): Promise<EmbedBuilder> {
    const queueStatus = this.queueService.getCurrentQueueSizeSync(game);
    const maxPlayers = this.queueService.getMaxPlayers(game);

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

    const gameLabel = game === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant';
    const embed = new EmbedBuilder()
      .setTitle(`${gameLabel} Queue is Always Open!`)
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
      const players = await this.databaseService.getQueuePlayersWithData(game);
      
      if (players.length > 0) {
        embed.addFields({
          name: 'Game',
          value: gameLabel,
          inline: true,
        });

        const playerList = players
          .slice(0, 10) // Show first 10 players
          .map((p, index) => {
            const isMarvel = game === 'marvel_rivals';
            const rank = isMarvel
              ? (p.marvel_rivals_rank || 'Unranked')
              : (p.valorant_rank || 'Unranked');
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

    embed.setFooter({ text: `Persistent Queue • ${gameLabel} • Use /queue start to create a new queue` });

    return embed;
  }

  /**
   * Create the buttons for the persistent queue message
   */
  private createQueueButtons(game: 'valorant' | 'marvel_rivals'): ActionRowBuilder<ButtonBuilder> {
    const joinButton = new ButtonBuilder()
      .setCustomId(`queue_join_button:${game}`)
      .setLabel('Join Queue')
      .setStyle(ButtonStyle.Primary);

    const leaveButton = new ButtonBuilder()
      .setCustomId(`queue_leave_button:${game}`)
      .setLabel('Leave Queue')
      .setStyle(ButtonStyle.Danger);

    return new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton);
  }

  /**
   * Get the persistent message ID and channel ID
   */
  getPersistentQueueInfo(game: 'valorant' | 'marvel_rivals'): { messageId: string | null; channelId: string | null } {
    return this.persistentMessages[game];
  }

  private async initializePersistentQueueForGame(
    lobbyChannel: TextChannel,
    existingMessages: any,
    game: 'valorant' | 'marvel_rivals'
  ): Promise<void> {
    const gameLabel = game === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant';
    const existingQueueMessage = existingMessages.find(
      (msg: any) =>
        msg.author.id === this.client.user?.id &&
        msg.embeds[0]?.footer?.text?.includes(`Persistent Queue • ${gameLabel}`)
    );

    if (existingQueueMessage) {
      this.persistentMessages[game] = {
        messageId: existingQueueMessage.id,
        channelId: lobbyChannel.id,
      };
      console.log('✅ Found existing persistent queue message', {
        game,
        messageId: existingQueueMessage.id,
      });
      await this.updatePersistentQueueMessage(game);
      return;
    }

    const embed = await this.createPersistentQueueEmbed(game);
    const buttons = this.createQueueButtons(game);

    const message = await lobbyChannel.send({
      embeds: [embed],
      components: [buttons],
    });

    this.persistentMessages[game] = {
      messageId: message.id,
      channelId: lobbyChannel.id,
    };

    console.log('✅ Created persistent queue message', {
      game,
      messageId: message.id,
      channelId: lobbyChannel.id,
    });
  }
}
