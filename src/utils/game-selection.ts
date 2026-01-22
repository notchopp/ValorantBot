import { DatabasePlayer } from '../database/supabase';

export type GameSelection = 'valorant' | 'marvel_rivals';
export type MatchMode = 'custom' | 'ranked';

export const GAME_CHOICES = [
  { name: 'Valorant', value: 'valorant' },
  { name: 'Marvel Rivals', value: 'marvel_rivals' },
];

export const MODE_CHOICES = [
  { name: 'Custom', value: 'custom' },
  { name: 'Ranked', value: 'ranked' },
];

export function normalizeGameSelection(game?: string | null): GameSelection {
  if (game === 'marvel_rivals') {
    return 'marvel_rivals';
  }
  return 'valorant';
}

export function normalizeModeSelection(mode?: string | null): MatchMode {
  if (mode === 'ranked') {
    return 'ranked';
  }
  return 'custom';
}

type GameSelectionSource = {
  preferred_game?: string | null;
  preferredGame?: string | null;
} | null | undefined;

export function resolveGameForPlayer(player?: GameSelectionSource, option?: string | null): GameSelection {
  if (option) {
    return normalizeGameSelection(option);
  }
  if (player?.preferred_game) {
    return normalizeGameSelection(player.preferred_game);
  }
  if (player?.preferredGame) {
    return normalizeGameSelection(player.preferredGame);
  }
  return 'valorant';
}

export function formatGameName(game: GameSelection): string {
  return game === 'marvel_rivals' ? 'Marvel Rivals' : 'Valorant';
}

export function formatModeName(mode: MatchMode): string {
  return mode === 'ranked' ? 'Ranked' : 'Custom';
}

type GameRankSource = Partial<Pick<
  DatabasePlayer,
  | 'valorant_rank'
  | 'valorant_mmr'
  | 'valorant_peak_mmr'
  | 'marvel_rivals_rank'
  | 'marvel_rivals_mmr'
  | 'marvel_rivals_peak_mmr'
  | 'discord_rank'
  | 'current_mmr'
  | 'peak_mmr'
>> &
  {
    valorantRank?: string;
    valorantMMR?: number;
    valorantPeakMMR?: number;
    marvelRivalsRank?: string;
    marvelRivalsMMR?: number;
    marvelRivalsPeakMMR?: number;
  };

export function getGameRankFields(player: GameRankSource, game: GameSelection) {
  if (game === 'marvel_rivals') {
    return {
      rank: player.marvel_rivals_rank || player.marvelRivalsRank || 'Unranked',
      mmr: player.marvel_rivals_mmr || player.marvelRivalsMMR || 0,
      peak: player.marvel_rivals_peak_mmr || player.marvelRivalsPeakMMR || 0,
    };
  }
  return {
    rank: player.valorant_rank || player.valorantRank || player.discord_rank || 'Unranked',
    mmr: player.valorant_mmr || player.valorantMMR || player.current_mmr || 0,
    peak: player.valorant_peak_mmr || player.valorantPeakMMR || player.peak_mmr || 0,
  };
}

export const GAME_MATCH_TYPES: Record<GameSelection, ('custom' | 'valorant' | 'marvel_rivals')[]> = {
  valorant: ['custom', 'valorant'],
  marvel_rivals: ['marvel_rivals'],
};

export function getMatchTypesForGame(game: GameSelection) {
  return GAME_MATCH_TYPES[game];
}

export function getMatchTypesForMode(game: GameSelection, mode: MatchMode) {
  if (mode === 'custom') {
    return ['custom'] as const;
  }
  return [game === 'marvel_rivals' ? 'marvel_rivals' : 'valorant'] as const;
}
