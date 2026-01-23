import { Player } from './Player';

export interface Team {
  players: Player[];
  teamId: 'A' | 'B';
  voiceChannelId?: string; // Voice channel ID for the team
}

export interface Match {
  matchId: string;
  teams: {
    teamA: Team;
    teamB: Team;
  };
  map: string;
  gameType: 'valorant' | 'marvel_rivals'; // Which game this match is for
  host: Player;
  hostInviteCode?: string; // Valorant custom game invite code
  hostConfirmed?: boolean; // Whether host has confirmed they're ready
  hostSelectedAt?: Date; // When host was selected
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
  host: Player,
  gameType: 'valorant' | 'marvel_rivals' = 'valorant'
): Match {
  return {
    matchId,
    teams: { teamA, teamB },
    map,
    gameType,
    host,
    startTime: new Date(),
    status: 'pending',
  };
}
