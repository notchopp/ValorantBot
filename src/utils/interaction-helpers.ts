import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';

/**
 * Safely defer an interaction reply
 * This should be called IMMEDIATELY at the start of every command handler
 * before any async operations (DB calls, API calls, etc.)
 */
export async function safeDefer(
  interaction: ChatInputCommandInteraction,
  ephemeral: boolean = false
): Promise<void> {
  // Only defer if not already deferred or replied
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({
        flags: ephemeral ? MessageFlags.Ephemeral : undefined,
      });
    } catch (error: any) {
      // If defer fails due to timeout (10062), it means interaction already expired
      // This can happen if user double-clicks or there's network delay
      if (error?.code === 10062) {
        // Don't log as error - interaction already expired, nothing we can do
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }
}

/**
 * Safely edit an interaction reply
 * Use this after deferring to avoid duplicate reply errors
 */
export async function safeEditReply(
  interaction: ChatInputCommandInteraction,
  options: Parameters<ChatInputCommandInteraction['editReply']>[0]
): Promise<void> {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(options);
    } else {
      // Fallback: if somehow not deferred, try to reply
      await interaction.reply({
        ...options,
        ephemeral: true,
      });
    }
  } catch (error: any) {
    // If interaction expired (10062), silently ignore - nothing we can do
    if (error?.code === 10062) {
      return;
    }
    // Re-throw other errors
    throw error;
  }
}
