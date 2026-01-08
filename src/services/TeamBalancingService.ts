import { Player } from '../models/Player';
import { Team } from '../models/Match';

export type BalancingMode = 'auto' | 'captain';

export class TeamBalancingService {
  balanceTeams(players: Player[], mode: BalancingMode = 'auto'): { teamA: Team; teamB: Team } {
    if (mode === 'captain') {
      return this.captainMode(players);
    }
    return this.autoBalance(players);
  }

  private autoBalance(players: Player[]): { teamA: Team; teamB: Team } {
    // Sort players by rank value (descending), with unranked at the end
    const sorted = [...players].sort((a, b) => {
      const aRank = a.rankValue ?? 0;
      const bRank = b.rankValue ?? 0;
      return bRank - aRank;
    });

    const teamA: Player[] = [];
    const teamB: Player[] = [];

    // Snake draft: A, B, B, A, A, B, B, A, ...
    for (let i = 0; i < sorted.length; i++) {
      if (i % 4 === 0 || i % 4 === 3) {
        teamA.push(sorted[i]);
      } else {
        teamB.push(sorted[i]);
      }
    }

    return {
      teamA: { players: teamA, teamId: 'A' },
      teamB: { players: teamB, teamId: 'B' },
    };
  }

  private captainMode(players: Player[]): { teamA: Team; teamB: Team } {
    // Sort by rank, pick top 2 as captains
    const sorted = [...players].sort((a, b) => {
      const aRank = a.rankValue ?? 0;
      const bRank = b.rankValue ?? 0;
      return bRank - aRank;
    });

    const captains = sorted.slice(0, 2);
    const remaining = sorted.slice(2);

    // Shuffle remaining for random order
    const shuffled = [...remaining].sort(() => Math.random() - 0.5);

    const teamA: Player[] = [captains[0]];
    const teamB: Player[] = [captains[1]];

    // Alternate picks
    for (let i = 0; i < shuffled.length; i++) {
      if (i % 2 === 0) {
        teamA.push(shuffled[i]);
      } else {
        teamB.push(shuffled[i]);
      }
    }

    return {
      teamA: { players: teamA, teamId: 'A' },
      teamB: { players: teamB, teamId: 'B' },
    };
  }

  getAverageRank(team: Team): number {
    if (team.players.length === 0) {
      return 0;
    }
    const sum = team.players.reduce((acc, p) => acc + (p.rankValue ?? 0), 0);
    return Number((sum / team.players.length).toFixed(2));
  }
}
