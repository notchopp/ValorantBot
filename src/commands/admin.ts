import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { DatabaseService } from '../services/DatabaseService';
import { MarvelRivalsAPIService } from '../services/MarvelRivalsAPIService';

// Admin user IDs who can use these commands
const ADMIN_IDS = [
  '713553695748390942', // Your Discord ID
];

// MMR values for each rank
const RANK_MMR_MAP: Record<string, { mmr: number; value: number }> = {
  'GRNDS I': { mmr: 150, value: 1 },
  'GRNDS II': { mmr: 450, value: 2 },
  'GRNDS III': { mmr: 750, value: 3 },
  'GRNDS IV': { mmr: 1050, value: 4 },
  'GRNDS V': { mmr: 1350, value: 5 },
  'BREAKPOINT I': { mmr: 1600, value: 6 },
  'BREAKPOINT II': { mmr: 1800, value: 7 },
  'BREAKPOINT III': { mmr: 2000, value: 8 },
  'BREAKPOINT IV': { mmr: 2150, value: 9 },
  'BREAKPOINT V': { mmr: 2300, value: 10 },
  'CHALLENGER I': { mmr: 2450, value: 11 },
  'CHALLENGER II': { mmr: 2550, value: 12 },
  'CHALLENGER III': { mmr: 2800, value: 13 },
  'X': { mmr: 3000, value: 15 },
};

// Map Marvel Rivals rank to Discord rank
function mapMarvelRankToDiscord(rank: string, tier: number = 1): string {
  const normalized = rank.toLowerCase().trim();
  
  // Handle top ranks (capped at GRNDS V for initial placement)
  if (normalized.includes('one above all')) return 'GRNDS V';
  if (normalized.includes('eternity')) return 'GRNDS V';
  if (normalized.includes('celestial')) return 'GRNDS V';
  if (normalized.includes('grandmaster')) return 'GRNDS V';
  
  if (normalized.includes('unranked') || normalized === '' || normalized === 'none') {
    return 'GRNDS I';
  }

  const tierOptions = (options: string[]) => {
    const index = Math.min(Math.max(tier, 1), options.length) - 1;
    return options[index];
  };

  if (normalized.includes('bronze')) return tierOptions(['GRNDS I', 'GRNDS II', 'GRNDS III']);
  if (normalized.includes('silver')) return tierOptions(['GRNDS II', 'GRNDS III', 'GRNDS IV']);
  if (normalized.includes('gold')) return tierOptions(['GRNDS II', 'GRNDS III', 'GRNDS IV']);
  if (normalized.includes('platinum')) return tierOptions(['GRNDS III', 'GRNDS IV', 'GRNDS V']);
  if (normalized.includes('diamond')) return 'GRNDS V';
  
  return 'GRNDS I';
}

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin commands for managing players')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub =>
    sub
      .setName('update-player')
      .setDescription('Request API update for a Marvel Rivals player (30-min cooldown)')
      .addStringOption(opt =>
        opt.setName('uid').setDescription('Marvel Rivals UID').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('verify-player')
      .setDescription('Re-fetch and verify a Marvel Rivals player rank')
      .addStringOption(opt =>
        opt.setName('uid').setDescription('Marvel Rivals UID').setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('set-rank')
      .setDescription('Manually set a player\'s Marvel Rivals rank')
      .addStringOption(opt =>
        opt.setName('uid').setDescription('Marvel Rivals UID').setRequired(true)
      )
      .addStringOption(opt =>
        opt
          .setName('rank')
          .setDescription('Discord rank to set')
          .setRequired(true)
          .addChoices(
            { name: 'GRNDS I', value: 'GRNDS I' },
            { name: 'GRNDS II', value: 'GRNDS II' },
            { name: 'GRNDS III', value: 'GRNDS III' },
            { name: 'GRNDS IV', value: 'GRNDS IV' },
            { name: 'GRNDS V', value: 'GRNDS V' },
            { name: 'BREAKPOINT I', value: 'BREAKPOINT I' },
            { name: 'BREAKPOINT II', value: 'BREAKPOINT II' },
            { name: 'BREAKPOINT III', value: 'BREAKPOINT III' },
            { name: 'BREAKPOINT IV', value: 'BREAKPOINT IV' },
            { name: 'BREAKPOINT V', value: 'BREAKPOINT V' },
            { name: 'CHALLENGER I', value: 'CHALLENGER I' },
            { name: 'CHALLENGER II', value: 'CHALLENGER II' },
            { name: 'CHALLENGER III', value: 'CHALLENGER III' },
            { name: 'X', value: 'X' }
          )
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('batch-update')
      .setDescription('Queue multiple players for API update (paste UIDs separated by commas)')
      .addStringOption(opt =>
        opt.setName('uids').setDescription('Comma-separated Marvel Rivals UIDs').setRequired(true)
      )
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    databaseService: DatabaseService;
    marvelRivalsAPI?: MarvelRivalsAPIService;
  }
) {
  // Check if user is admin
  if (!ADMIN_IDS.includes(interaction.user.id)) {
    await interaction.reply({
      content: '❌ You do not have permission to use admin commands.',
      ephemeral: true,
    });
    return;
  }

  const { databaseService, marvelRivalsAPI } = services;
  const subcommand = interaction.options.getSubcommand();

  if (!marvelRivalsAPI) {
    await interaction.reply({
      content: '❌ Marvel Rivals API service is not available.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    switch (subcommand) {
      case 'update-player': {
        const uid = interaction.options.getString('uid', true);
        
        const embed = new EmbedBuilder()
          .setTitle('🔄 Requesting Player Update')
          .setColor(0x5865f2)
          .setDescription(`Requesting API update for UID: \`${uid}\`\n\nThis queues the player for a data refresh. It may take 0-5 minutes for the update to complete.`);
        
        await interaction.editReply({ embeds: [embed] });
        
        const success = await marvelRivalsAPI.updatePlayer(uid);
        
        if (success) {
          embed.setTitle('✅ Update Requested')
            .setColor(0x00ff00)
            .setDescription(`Successfully queued \`${uid}\` for update.\n\n⏰ Wait 5-10 minutes, then use \`/admin verify-player\` to re-fetch their rank.`);
        } else {
          embed.setTitle('⚠️ Update May Have Failed')
            .setColor(0xf5a623)
            .setDescription(`Could not confirm update for \`${uid}\`.\n\nThis player may be on cooldown (30-min limit) or the API is unavailable.`);
        }
        
        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'verify-player': {
        const uid = interaction.options.getString('uid', true);
        
        if (!databaseService.supabase) {
          await interaction.editReply('❌ Database not available.');
          return;
        }
        
        // Find player in database
        const { data: player } = await databaseService.supabase
          .from('players')
          .select('*')
          .eq('marvel_rivals_uid', uid)
          .single();

        if (!player) {
          await interaction.editReply(`❌ No player found with UID: \`${uid}\``);
          return;
        }

        // Fetch fresh stats
        const stats = await marvelRivalsAPI.getPlayerStats(uid);
        
        if (!stats) {
          await interaction.editReply(`❌ Could not fetch stats for \`${uid}\`. API may be unavailable.`);
          return;
        }

        // Extract rank from stats
        const rawRank = stats.rank as string | undefined;
        const tier = typeof stats.tier === 'number' ? stats.tier : 1;
        
        if (!rawRank || rawRank.toLowerCase().includes('invalid') || /^\d+$/.test(rawRank)) {
          await interaction.editReply({
            content: `⚠️ Player \`${uid}\` still has invalid rank data: \`${rawRank || 'null'}\`\n\nTry \`/admin update-player\` first, wait 5-10 min, then verify again.`,
          });
          return;
        }

        const discordRank = mapMarvelRankToDiscord(rawRank, tier);
        const rankInfo = RANK_MMR_MAP[discordRank] || { mmr: 150, value: 1 };

        // Update player in database
        await databaseService.supabase
          .from('players')
          .update({
            marvel_rivals_rank: discordRank,
            marvel_rivals_mmr: rankInfo.mmr,
            marvel_rivals_rank_value: rankInfo.value,
            discord_rank: discordRank,
            discord_rank_value: rankInfo.value,
            current_mmr: rankInfo.mmr,
            updated_at: new Date().toISOString(),
          })
          .eq('marvel_rivals_uid', uid);

        const embed = new EmbedBuilder()
          .setTitle('✅ Player Verified')
          .setColor(0x00ff00)
          .addFields(
            { name: 'Player', value: player.discord_username || uid, inline: true },
            { name: 'Marvel Rank', value: rawRank, inline: true },
            { name: 'Discord Rank', value: discordRank, inline: true },
            { name: 'MMR', value: String(rankInfo.mmr), inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'set-rank': {
        const uid = interaction.options.getString('uid', true);
        const rank = interaction.options.getString('rank', true);
        const rankInfo = RANK_MMR_MAP[rank];

        if (!rankInfo) {
          await interaction.editReply(`❌ Invalid rank: ${rank}`);
          return;
        }

        if (!databaseService.supabase) {
          await interaction.editReply('❌ Database not available.');
          return;
        }

        // Find and update player
        const { data: player, error } = await databaseService.supabase
          .from('players')
          .update({
            marvel_rivals_rank: rank,
            marvel_rivals_mmr: rankInfo.mmr,
            marvel_rivals_rank_value: rankInfo.value,
            discord_rank: rank,
            discord_rank_value: rankInfo.value,
            current_mmr: rankInfo.mmr,
            updated_at: new Date().toISOString(),
          })
          .eq('marvel_rivals_uid', uid)
          .select()
          .single();

        if (error || !player) {
          await interaction.editReply(`❌ No player found with UID: \`${uid}\``);
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('✅ Rank Set Manually')
          .setColor(0x00ff00)
          .addFields(
            { name: 'Player', value: player.discord_username || uid, inline: true },
            { name: 'New Rank', value: rank, inline: true },
            { name: 'New MMR', value: String(rankInfo.mmr), inline: true }
          );

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      case 'batch-update': {
        const uidsRaw = interaction.options.getString('uids', true);
        const uids = uidsRaw.split(',').map(u => u.trim()).filter(u => u.length > 0);

        if (uids.length === 0) {
          await interaction.editReply('❌ No valid UIDs provided.');
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🔄 Batch Update Started')
          .setColor(0x5865f2)
          .setDescription(`Requesting updates for ${uids.length} players...\n\n⚠️ Each player has a 30-min cooldown. Updates will be queued.`);

        await interaction.editReply({ embeds: [embed] });

        const results: string[] = [];
        for (const uid of uids) {
          const success = await marvelRivalsAPI.updatePlayer(uid);
          results.push(`${success ? '✅' : '⚠️'} ${uid}`);
          // Small delay between requests to avoid rate limiting
          await new Promise(r => setTimeout(r, 500));
        }

        embed.setTitle('📋 Batch Update Complete')
          .setColor(0x00ff00)
          .setDescription(`Requested updates for ${uids.length} players:\n\n${results.join('\n')}\n\n⏰ Wait 5-10 minutes, then use \`/admin verify-player\` for each.`);

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (error) {
    console.error('Admin command error:', error);
    await interaction.editReply(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
