import { Player } from './Player';

export interface Team {
  players: Player[];
  teamId: 'A' | 'B';
}

export interface Match {
  matchId: string;
  teams: {
    teamA: Team;
    teamB: Team;
  };
  map: string;
  host: Player;
  startTime: Date;
  endTime?: Date;
  winner?: 'A' | 'B';
  score?: {
    teamA: number;
    teamB: number;
  };
  playerStats?: Map<string, MatchPlayerStats>;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  teamAChannelId?: string; // Voice channel ID for Team A
  teamBChannelId?: string; // Voice channel ID for Team B
}

export interface MatchPlayerStats {
  kills: number;
  deaths: number;
  assists?: number;
  mvp: boolean;
}

export function createMatch(
  matchId: string,
  teamA: Team,
  teamB: Team,
  map: string,
  host: Player
): Match {
  return {
    matchId,
    teams: { teamA, teamB },
    map,
    host,
    startTime: new Date(),
    status: 'pending',
  };
}
