import { Match, createMatch, MatchPlayerStats } from '../models/Match';
import { Player } from '../models/Player';
import { Config } from '../config/config';
import { TeamBalancingService, BalancingMode } from './TeamBalancingService';

export class MatchService {
  private matches: Map<string, Match> = new Map();
  private currentMatch: Match | null = null;
  private config: Config;
  private teamBalancer: TeamBalancingService;

  constructor(config: Config) {
    this.config = config;
    this.teamBalancer = new TeamBalancingService();
  }

  createMatch(
    players: Player[],
    mode: BalancingMode = 'auto',
    map?: string,
    gameType: 'valorant' | 'marvel_rivals' = 'valorant'
  ): Match {
    const matchId = `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Balance teams
    const { teamA, teamB } = this.teamBalancer.balanceTeams(players, mode);

    // Select map
    const selectedMap = map || this.selectRandomMap();

    // Select host (random from team A)
    const host = teamA.players[Math.floor(Math.random() * teamA.players.length)];

    const match = createMatch(matchId, teamA, teamB, selectedMap, host, gameType);
    this.matches.set(matchId, match);
    this.currentMatch = match;

    return match;
  }

  getCurrentMatch(): Match | null {
    return this.currentMatch;
  }

  getMatch(matchId: string): Match | undefined {
    return this.matches.get(matchId);
  }

  reportMatch(
    matchId: string,
    winner: 'A' | 'B',
    score?: { teamA: number; teamB: number },
    playerStats?: Map<string, MatchPlayerStats>
  ): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    match.winner = winner;
    match.score = score;
    match.endTime = new Date();
    match.status = 'completed';
    if (playerStats) {
      match.playerStats = playerStats;
    }

    return true;
  }

  cancelMatch(matchId: string): boolean {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    match.status = 'cancelled';
    match.endTime = new Date();
    this.currentMatch = null;

    return true;
  }

  private selectRandomMap(): string {
    const maps = this.config.maps;
    return maps[Math.floor(Math.random() * maps.length)];
  }

  getAllMatches(): Match[] {
    return Array.from(this.matches.values());
  }

  // For future persistence
  getMatchesData(): Map<string, Match> {
    return this.matches;
  }

  loadMatchesData(matches: Map<string, Match>): void {
    this.matches = matches;
  }
}
