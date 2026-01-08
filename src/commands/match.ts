import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
} from 'discord.js';
import { MatchService } from '../services/MatchService';
import { PlayerService } from '../services/PlayerService';
import { DatabaseService } from '../services/DatabaseService';
import { RankCalculationService } from '../services/RankCalculationService';
import { CustomRankService } from '../services/CustomRankService';
import { RoleUpdateService } from '../services/RoleUpdateService';
import { Config } from '../config/config';

export const data = new SlashCommandBuilder()
  .setName('match')
  .setDescription('Match management commands')
  .addSubcommand((subcommand: any) =>
    subcommand.setName('report').setDescription('Report match results')
  )
  .addSubcommand((subcommand: any) =>
    subcommand.setName('info').setDescription('View current match info')
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  services: {
    matchService: MatchService;
    playerService: PlayerService;
    databaseService: DatabaseService;
    rankCalculationService: RankCalculationService;
    customRankService: CustomRankService;
    roleUpdateService: RoleUpdateService;
    config: Config;
  }
) {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'report') {
    await handleReport(interaction, services);
  } else if (subcommand === 'info') {
    await handleInfo(interaction, services);
  }
}

async function handleReport(
  interaction: ChatInputCommandInteraction,
  services: {
    matchService: MatchService;
    playerService: PlayerService;
    config: Config;
  }
) {
  const { matchService } = services;
  const currentMatch = matchService.getCurrentMatch();

  if (!currentMatch || currentMatch.status === 'completed') {
    await interaction.reply({
      content: '❌ No active match found to report.',
      ephemeral: true,
    });
    return;
  }

  // Create modal for match reporting
  const modal = new ModalBuilder()
    .setCustomId('match_report_modal')
    .setTitle('Report Match Results');

  const winnerInput = new TextInputBuilder()
    .setCustomId('winner')
    .setLabel('Winner (A or B)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('A or B');

  const scoreInput = new TextInputBuilder()
    .setCustomId('score')
    .setLabel('Score (optional, format: 13-10)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setPlaceholder('13-10');

  const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(winnerInput);
  const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(scoreInput);

  modal.addComponents(firstRow, secondRow);

  await interaction.showModal(modal);
}

async function handleInfo(
  interaction: ChatInputCommandInteraction,
  services: {
    matchService: MatchService;
    playerService: PlayerService;
    databaseService: DatabaseService;
    rankCalculationService: RankCalculationService;
    customRankService: CustomRankService;
    roleUpdateService: RoleUpdateService;
    config: Config;
  }
) {
  await interaction.deferReply();

  const { matchService } = services;
  const currentMatch = matchService.getCurrentMatch();

  if (!currentMatch) {
    await interaction.editReply('❌ No active match found.');
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🎮 Match Information')
    .setColor(0x00ff00)
    .addFields(
      {
        name: 'Match ID',
        value: currentMatch.matchId,
        inline: true,
      },
      {
        name: 'Map',
        value: currentMatch.map,
        inline: true,
      },
      {
        name: 'Host',
        value: currentMatch.host.username,
        inline: true,
      },
      {
        name: 'Status',
        value: currentMatch.status,
        inline: true,
      }
    );

  const teamAList = currentMatch.teams.teamA.players
    .map((p) => {
      const rank = p.rank ? ` [${p.rank}]` : '';
      return `• ${p.username}${rank}`;
    })
    .join('\n');

  const teamBList = currentMatch.teams.teamB.players
    .map((p) => {
      const rank = p.rank ? ` [${p.rank}]` : '';
      return `• ${p.username}${rank}`;
    })
    .join('\n');

  embed
    .addFields({ name: '🔵 Team A', value: teamAList || 'None', inline: true })
    .addFields({ name: '🔴 Team B', value: teamBList || 'None', inline: true });

  if (currentMatch.winner) {
    embed.addFields({
      name: 'Winner',
      value: `Team ${currentMatch.winner}`,
      inline: true,
    });
  }

  if (currentMatch.score) {
    embed.addFields({
      name: 'Score',
      value: `${currentMatch.score.teamA}-${currentMatch.score.teamB}`,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

// Export handler for modal submission
export async function handleMatchReportModal(
  interaction: ModalSubmitInteraction,
  services: {
    matchService: MatchService;
    playerService: PlayerService;
    databaseService: DatabaseService;
    rankCalculationService: RankCalculationService;
    customRankService: CustomRankService;
    roleUpdateService: RoleUpdateService;
    config: Config;
  }
) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const username = interaction.user.username;

  try {
    const { matchService, playerService, databaseService, rankCalculationService, customRankService, roleUpdateService } = services;
    
    // Validate guild exists
    if (!interaction.guild) {
      await interaction.editReply({
        content: '❌ This command can only be used in a server.',
      });
      return;
    }
    const currentMatch = matchService.getCurrentMatch();

    if (!currentMatch) {
      await interaction.editReply({
        content: '❌ No active match found.',
      });
      return;
    }

    const winner = interaction.fields.getTextInputValue('winner').toUpperCase();
    const scoreText = interaction.fields.getTextInputValue('score');

    // Input validation
    if (winner !== 'A' && winner !== 'B') {
      await interaction.editReply({
        content: '❌ Winner must be either "A" or "B".',
      });
      return;
    }

    let score: { teamA: number; teamB: number } | undefined;
    if (scoreText) {
      const parts = scoreText.split('-');
      if (parts.length === 2) {
        const teamAScore = parseInt(parts[0].trim(), 10);
        const teamBScore = parseInt(parts[1].trim(), 10);
        if (!isNaN(teamAScore) && !isNaN(teamBScore)) {
          score = { teamA: teamAScore, teamB: teamBScore };
        }
      }
    }

    // Step 1: Save match to Supabase (if not already saved)
    let dbMatch = await databaseService.getMatch(currentMatch.matchId);
    if (!dbMatch) {
      // Create match in database
      const teamAUserIds = currentMatch.teams.teamA.players.map(p => p.userId);
      const teamBUserIds = currentMatch.teams.teamB.players.map(p => p.userId);
      
      dbMatch = await databaseService.createMatch({
        matchId: currentMatch.matchId,
        map: currentMatch.map,
        hostUserId: currentMatch.host.userId,
        teamA: teamAUserIds,
        teamB: teamBUserIds,
        matchType: 'custom',
      });

      if (!dbMatch) {
        await interaction.editReply({
          content: '❌ Failed to save match to database.',
        });
        return;
      }
    }

    // Step 2: Save player stats to database (with defaults for now)
    const allPlayers = [...currentMatch.teams.teamA.players, ...currentMatch.teams.teamB.players];
    const winningTeam = winner === 'A' ? currentMatch.teams.teamA : currentMatch.teams.teamB;
    
    for (const player of allPlayers) {
      const dbPlayer = await databaseService.getPlayer(player.userId);
      if (!dbPlayer) continue;

      const team = currentMatch.teams.teamA.players.some(p => p.userId === player.userId) ? 'A' : 'B';
      
      // Get current MMR
      const currentMMR = dbPlayer.current_mmr || 0;

      // Create player stats (defaults for now - can be enhanced later)
      await databaseService.createMatchPlayerStats(
        currentMatch.matchId,
        player.userId,
        {
          team: team as 'A' | 'B',
          kills: 0, // TODO: Collect from modal or match data
          deaths: 0, // TODO: Collect from modal or match data
          assists: 0, // TODO: Collect from modal or match data
          mvp: false, // TODO: Collect from modal or match data
          damage: 0, // TODO: Collect from modal or match data
          score: 0, // TODO: Collect from modal or match data
          mmrBefore: currentMMR,
        }
      );
    }

    // Step 3: Update match with winner and score
    await databaseService.updateMatch(currentMatch.matchId, {
      winner: winner as 'A' | 'B',
      score,
      status: 'completed',
    });

    // Update in-memory match
    matchService.reportMatch(currentMatch.matchId, winner as 'A' | 'B', score);

    // Step 4: Trigger rank calculation
    let rankResults: Array<{
      playerId: string;
      oldMMR: number;
      newMMR: number;
      oldRank: string;
      newRank: string;
      rankChanged: boolean;
      pointsEarned: number;
    }> = [];
    try {
      rankResults = await rankCalculationService.calculateMatchRankChanges(currentMatch.matchId);
    } catch (error) {
      console.error('Error calculating rank changes', {
        matchId: currentMatch.matchId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Continue even if rank calculation fails
    }

    // Step 5: Update player stats (games played, wins, losses)
    for (const player of allPlayers) {
      const isWinner = winningTeam.players.some(p => p.userId === player.userId);
      const p = await playerService.getPlayer(player.userId);
      if (p) {
        await playerService.updatePlayerStats(player.userId, {
          gamesPlayed: p.stats.gamesPlayed + 1,
          wins: isWinner ? p.stats.wins + 1 : p.stats.wins,
          losses: isWinner ? p.stats.losses : p.stats.losses + 1,
        });
      }
    }

    // Step 6: Post match summary with MMR changes and rank-ups
    const embed = new EmbedBuilder()
      .setTitle('✅ Match Reported')
      .setColor(0x00ff00)
      .setDescription(`Match **${currentMatch.matchId}** has been completed.`)
      .addFields({
        name: 'Winner',
        value: `Team ${winner}`,
        inline: true,
      });

    if (score) {
      embed.addFields({
        name: 'Score',
        value: `${score.teamA}-${score.teamB}`,
        inline: true,
      });
    }

    // Add MMR changes
    if (rankResults && rankResults.length > 0) {
      const mmrChanges = rankResults
        .map(r => {
          const player = allPlayers.find(p => p.userId === r.playerId);
          const username = player?.username || 'Unknown';
          const sign = r.pointsEarned >= 0 ? '+' : '';
          return `**${username}**: ${sign}${r.pointsEarned} MMR (${r.oldMMR} → ${r.newMMR})`;
        })
        .join('\n');

      embed.addFields({
        name: '📊 MMR Changes',
        value: mmrChanges || 'No changes',
        inline: false,
      });

      // Step 5: Update Discord roles for rank changes
      for (const result of rankResults) {
        if (result.rankChanged) {
          try {
            await roleUpdateService.updatePlayerRole(
              result.playerId,
              result.oldRank,
              result.newRank,
              interaction.guild!
            );
          } catch (error) {
            console.error('Error updating role for player', {
              playerId: result.playerId,
              oldRank: result.oldRank,
              newRank: result.newRank,
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue with other players even if one fails
          }
        }
      }

      // Step 6: Update X rank if any player reached CHALLENGER or significant MMR change
      // Check if any player is in CHALLENGER tier or above (potential X rank candidate)
      const hasChallengerPlayers = rankResults.some(r => {
        const rankValue = customRankService.getRankValue(r.newRank);
        return rankValue >= 11; // CHALLENGER I or above
      });

      // Also check for significant MMR changes (>= 2000 MMR)
      const hasHighMMRPlayers = rankResults.some(r => r.newMMR >= 2000);

      if (hasChallengerPlayers || hasHighMMRPlayers) {
        try {
          await customRankService.updateXRank();
        } catch (error) {
          console.error('Error updating X rank', {
            matchId: currentMatch.matchId,
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't fail match reporting if X rank update fails
        }
      }

      // Add rank-ups/downs (using customRankService for rank value comparison)
      const rankUps = rankResults.filter(r => {
        if (!r.rankChanged) return false;
        const oldValue = customRankService.getRankValue(r.oldRank);
        const newValue = customRankService.getRankValue(r.newRank);
        return newValue > oldValue;
      });
      const rankDowns = rankResults.filter(r => {
        if (!r.rankChanged) return false;
        const oldValue = customRankService.getRankValue(r.oldRank);
        const newValue = customRankService.getRankValue(r.newRank);
        return newValue < oldValue;
      });

      if (rankUps.length > 0) {
        const rankUpText = rankUps
          .map(r => {
            const player = allPlayers.find(p => p.userId === r.playerId);
            const username = player?.username || 'Unknown';
            return `**${username}**: ${r.oldRank} → ${r.newRank} 🎉`;
          })
          .join('\n');

        embed.addFields({
          name: '⬆️ Rank Ups',
          value: rankUpText,
          inline: false,
        });
      }

      if (rankDowns.length > 0) {
        const rankDownText = rankDowns
          .map(r => {
            const player = allPlayers.find(p => p.userId === r.playerId);
            const username = player?.username || 'Unknown';
            return `**${username}**: ${r.oldRank} → ${r.newRank}`;
          })
          .join('\n');

        embed.addFields({
          name: '⬇️ Rank Downs',
          value: rankDownText,
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Match report modal error', {
      userId,
      username,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    await interaction.editReply({
      content: '❌ An error occurred while reporting the match. Please try again later.',
    });
  }
}
