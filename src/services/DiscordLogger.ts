import { Client, TextChannel, EmbedBuilder } from 'discord.js';

/**
 * Discord Logger Service
 * Sends all logs to a Discord channel for monitoring
 * Intercepts console.log, console.error, console.warn, console.debug
 * Follows guardrails: error handling, rate limiting, type safety
 */
export class DiscordLogger {
  private logChannel: TextChannel | null = null;
  private logQueue: Array<{ level: string; message: string; data?: any; retried?: boolean }> = [];
  private processingQueue = false;
  private readonly MAX_MESSAGE_LENGTH = 2000; // Discord message limit
  private readonly RATE_LIMIT_DELAY = 1000; // 1 second between messages to avoid rate limits
  private lastMessageTime = 0;
  private originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    debug: typeof console.debug;
  } | null = null;

  constructor(private client: Client, private channelId: string | null) {
    if (channelId) {
      this.initializeChannel();
    } else {
      console.warn('⚠️  DISCORD_LOG_CHANNEL_ID not set - Discord logging disabled');
    }
  }

  /**
   * Initialize the log channel and intercept console methods
   */
  private async initializeChannel(): Promise<void> {
    if (!this.channelId) return;

    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (channel && channel.isTextBased()) {
        this.logChannel = channel as TextChannel;
        this.interceptConsole();
        // Use original console to avoid recursion
        if (this.originalConsole) {
          this.originalConsole.log('✅ Discord logger initialized', { channelId: this.channelId });
        }
      } else {
        console.error('❌ Discord log channel is not a text channel', { channelId: this.channelId });
      }
    } catch (error) {
      console.error('❌ Failed to initialize Discord log channel', {
        channelId: this.channelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Intercept console methods to send all logs to Discord
   */
  private interceptConsole(): void {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      error: console.error.bind(console),
      warn: console.warn.bind(console),
      debug: console.debug.bind(console),
    };

    // Override console.log
    console.log = (...args: any[]) => {
      if (this.originalConsole) {
        this.originalConsole.log(...args);
      }
      const message = this.formatConsoleArgs(args);
      this.log('info', message).catch(() => {
        // Ignore errors in logging to avoid infinite loops
      });
    };

    // Override console.error
    console.error = (...args: any[]) => {
      if (this.originalConsole) {
        this.originalConsole.error(...args);
      }
      const message = this.formatConsoleArgs(args);
      this.log('error', message).catch(() => {
        // Ignore errors in logging to avoid infinite loops
      });
    };

    // Override console.warn
    console.warn = (...args: any[]) => {
      if (this.originalConsole) {
        this.originalConsole.warn(...args);
      }
      const message = this.formatConsoleArgs(args);
      this.log('warn', message).catch(() => {
        // Ignore errors in logging to avoid infinite loops
      });
    };

    // Override console.debug
    console.debug = (...args: any[]) => {
      if (this.originalConsole) {
        this.originalConsole.debug(...args);
      }
      const message = this.formatConsoleArgs(args);
      this.log('debug', message).catch(() => {
        // Ignore errors in logging to avoid infinite loops
      });
    };
  }

  /**
   * Format console arguments into a string
   */
  private formatConsoleArgs(args: any[]): string {
    return args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  }

  /**
   * Restore original console methods (for cleanup)
   */
  restoreConsole(): void {
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.error = this.originalConsole.error;
      console.warn = this.originalConsole.warn;
      console.debug = this.originalConsole.debug;
    }
  }

  /**
   * Log a message to Discord
   */
  async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any): Promise<void> {
    // Always log to console first - use originalConsole to avoid recursion
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    // Use originalConsole to avoid infinite recursion
    if (this.originalConsole) {
      switch (level) {
        case 'error':
          this.originalConsole.error(logMessage, data || '');
          break;
        case 'warn':
          this.originalConsole.warn(logMessage, data || '');
          break;
        case 'debug':
          this.originalConsole.debug(logMessage, data || '');
          break;
        default:
          this.originalConsole.log(logMessage, data || '');
      }
    } else {
      // Fallback if originalConsole not set yet
      switch (level) {
        case 'error':
          console.error(logMessage, data || '');
          break;
        case 'warn':
          console.warn(logMessage, data || '');
          break;
        case 'debug':
          console.debug(logMessage, data || '');
          break;
        default:
          console.log(logMessage, data || '');
      }
    }

    // Add to queue for Discord
    if (this.logChannel) {
      this.logQueue.push({ level, message, data });
      this.processQueue();
    }
  }

  /**
   * Process the log queue
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.logQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.logQueue.length > 0) {
        const logEntry = this.logQueue.shift();
        if (!logEntry || !this.logChannel) continue;

        // Rate limit: wait if needed
        const now = Date.now();
        const timeSinceLastMessage = now - this.lastMessageTime;
        if (timeSinceLastMessage < this.RATE_LIMIT_DELAY) {
          await new Promise((resolve) => setTimeout(resolve, this.RATE_LIMIT_DELAY - timeSinceLastMessage));
        }

        try {
          await this.sendLogToDiscord(logEntry.level, logEntry.message, logEntry.data);
          this.lastMessageTime = Date.now();
        } catch (error) {
          // If sending fails, put it back in the queue (but only once to avoid infinite loops)
          if (!logEntry.retried) {
            logEntry.retried = true;
            this.logQueue.unshift(logEntry);
          }
          // Use originalConsole to avoid recursion
          if (this.originalConsole) {
            this.originalConsole.error('Failed to send log to Discord', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Send a log entry to Discord
   */
  private async sendLogToDiscord(level: string, message: string, data?: any): Promise<void> {
    if (!this.logChannel) return;

    const color = this.getColorForLevel(level);
    const emoji = this.getEmojiForLevel(level);

    // Format data if provided
    let dataString = '';
    if (data) {
      try {
        // Truncate large data objects
        const dataStr = JSON.stringify(data, null, 2);
        if (dataStr.length > 1000) {
          dataString = `\n\`\`\`json\n${dataStr.substring(0, 1000)}...\n\`\`\``;
        } else {
          dataString = `\n\`\`\`json\n${dataStr}\n\`\`\``;
        }
      } catch (error) {
        dataString = `\n\`\`\`\n${String(data)}\n\`\`\``;
      }
    }

    // Truncate message if too long
    let fullMessage = `${emoji} **${level.toUpperCase()}**\n${message}${dataString}`;
    if (fullMessage.length > this.MAX_MESSAGE_LENGTH) {
      fullMessage = fullMessage.substring(0, this.MAX_MESSAGE_LENGTH - 3) + '...';
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(fullMessage)
      .setTimestamp()
      .setFooter({ text: `Level: ${level}` });

    await this.logChannel.send({ embeds: [embed] });
  }

  /**
   * Get color for log level
   */
  private getColorForLevel(level: string): number {
    switch (level) {
      case 'error':
        return 0xff0000; // Red
      case 'warn':
        return 0xff9900; // Orange
      case 'info':
        return 0x0099ff; // Blue
      case 'debug':
        return 0x00ff00; // Green
      default:
        return 0x808080; // Gray
    }
  }

  /**
   * Get emoji for log level
   */
  private getEmojiForLevel(level: string): string {
    switch (level) {
      case 'error':
        return '❌';
      case 'warn':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'debug':
        return '🔍';
      default:
        return '📝';
    }
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log('info', message, data).catch((error) => {
      // Use originalConsole to avoid recursion
      if (this.originalConsole) {
        this.originalConsole.error('Failed to log info to Discord', { error });
      }
    });
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data).catch((error) => {
      // Use originalConsole to avoid recursion
      if (this.originalConsole) {
        this.originalConsole.error('Failed to log warn to Discord', { error });
      }
    });
  }

  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    this.log('error', message, data).catch((error) => {
      // Use originalConsole to avoid recursion
      if (this.originalConsole) {
        this.originalConsole.error('Failed to log error to Discord', { error });
      }
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data).catch((error) => {
      // Use originalConsole to avoid recursion
      if (this.originalConsole) {
        this.originalConsole.error('Failed to log debug to Discord', { error });
      }
    });
  }
}
