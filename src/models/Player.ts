export interface Player {
  userId: string;
  username: string;
  rank?: string;
  rankValue?: number;
  preferredGame?: 'valorant' | 'marvel_rivals';
  primaryGame?: 'valorant' | 'marvel_rivals';
  roleMode?: 'highest' | 'primary';
  // Riot ID for API lookups
  riotId?: {
    name: string;
    tag: string;
    region?: string;
    puuid?: string;
  };
  // Marvel Rivals ID for API lookups
  marvelRivalsId?: {
    uid: string;
    username: string;
  };
  valorantRank?: string;
  valorantRankValue?: number;
  valorantMMR?: number;
  valorantPeakMMR?: number;
  marvelRivalsRank?: string;
  marvelRivalsRankValue?: number;
  marvelRivalsMMR?: number;
  marvelRivalsPeakMMR?: number;
  stats: PlayerStats;
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  points: number;
  mvps: number;
}

export function createPlayer(userId: string, username: string): Player {
  return {
    userId,
    username,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      kills: 0,
      deaths: 0,
      points: 0,
      mvps: 0,
    },
  };
}

export function getKD(player: Player): number {
  if (player.stats.deaths === 0) {
    return player.stats.kills;
  }
  return Number((player.stats.kills / player.stats.deaths).toFixed(2));
}

export function getWinRate(player: Player): number {
  if (player.stats.gamesPlayed === 0) {
    return 0;
  }
  return Number(((player.stats.wins / player.stats.gamesPlayed) * 100).toFixed(1));
}
