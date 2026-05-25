export const SCORE_UNITS = [
  'points',
  'goals',
  'runs',
  'sets',
  'wins',
  'strokes',
  'pins',
  'touchdowns',
  'baskets',
  'aces',
  'rounds',
  'laps',
  'wickets',
  'score',
] as const;

export type ScoreUnit = (typeof SCORE_UNITS)[number];

export const DEFAULT_SCORE_UNIT: ScoreUnit = 'points';

export const SCORE_UNIT_LABELS: Record<ScoreUnit, string> = {
  points: 'Points',
  goals: 'Goals',
  runs: 'Runs',
  sets: 'Sets',
  wins: 'Wins',
  strokes: 'Strokes',
  pins: 'Pins',
  touchdowns: 'Touchdowns',
  baskets: 'Baskets',
  aces: 'Aces',
  rounds: 'Rounds',
  laps: 'Laps',
  wickets: 'Wickets',
  score: 'Score',
};

export const SCORE_UNIT_ABBREVIATIONS: Record<ScoreUnit, string> = {
  points: 'pts',
  goals: 'goals',
  runs: 'runs',
  sets: 'sets',
  wins: 'wins',
  strokes: 'strokes',
  pins: 'pins',
  touchdowns: 'TD',
  baskets: 'baskets',
  aces: 'aces',
  rounds: 'rnd',
  laps: 'laps',
  wickets: 'wkt',
  score: 'score',
};

export function isScoreUnit(value: string): value is ScoreUnit {
  return (SCORE_UNITS as readonly string[]).includes(value);
}

export function normalizeScoreUnit(value: unknown): ScoreUnit {
  return typeof value === 'string' && isScoreUnit(value) ? value : DEFAULT_SCORE_UNIT;
}

export function formatScoreWithUnit(score: string, unit: ScoreUnit): string {
  const trimmed = score.trim();
  if (!trimmed) {
    return '';
  }
  return `${trimmed} ${SCORE_UNIT_ABBREVIATIONS[unit]}`;
}
