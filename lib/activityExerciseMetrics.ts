import type { ActivityType } from '@/lib/activityTypes';
import { formatCardioDistanceWithUnit } from '@/lib/cardioDistanceUnits';
import {
  getCardioLogLayout,
  isCardioDistancePerDuration,
  isCardioDurationPerDistance,
  normalizeCardioPlanFields,
} from '@/lib/cardioPlan';
import {
  cardioPerSegmentUsesIntegerObjectiveUnits,
  type CardioPerSegmentExercise,
} from '@/lib/cardioPerLog';
import {
  DURATION_UNIT_ABBREVIATIONS,
  formatDurationValue,
  formatDurationWithUnit,
  type DurationUnit,
} from '@/lib/durationUnits';
import { hasLoggedExerciseActual } from '@/lib/exerciseDisplay';
import { formatScoreWithUnit, SCORE_UNIT_ABBREVIATIONS, type ScoreUnit } from '@/lib/scoreUnits';
import { readStretchSetsFromExercise } from '@/lib/stretchSets';
import { DISPLAY_DECIMAL_PLACES, formatDisplayDecimal } from '@/lib/displayDecimals';
import {
  forEachLoggedExerciseForTarget,
  type StoredExerciseMetricTarget,
} from '@/lib/exerciseSnapshot';
import type { LoggedWorkout, LoggedWorkoutExercise } from '@/lib/types';

export type SessionValueSnapshot = {
  createdAt: string;
  actual: number;
  planned: number;
  executionRatio: number;
};

export type SessionExecutionSnapshot = {
  createdAt: string;
  executionRatio: number;
};

export type CardioPersonalRecords = {
  maxDistance: number | null;
  maxDistanceUnit: LoggedWorkoutExercise['distanceUnit'] | null;
  maxDuration: number | null;
  maxDurationUnit: DurationUnit | null;
  bestPaceDistancePerDuration: number | null;
  bestPaceDistanceUnit: LoggedWorkoutExercise['distanceUnit'] | null;
  bestPaceDurationUnit: DurationUnit | null;
};

export type SportPersonalRecords = {
  maxDuration: number | null;
  maxDurationUnit: DurationUnit | null;
  maxNumericScore: number | null;
  maxScoreUnit: ScoreUnit | null;
  bestScoreLabel: string | null;
};

export type StretchPersonalRecords = {
  maxSingleSetDuration: number | null;
  maxSingleSetUnit: DurationUnit | null;
  maxSetsInSession: number | null;
  maxTotalSessionDuration: number | null;
  maxTotalSessionUnit: DurationUnit | null;
};

function sumCardioPerSetDistances(exercise: LoggedWorkoutExercise): number {
  return (exercise.actualCardioPerSets ?? []).reduce((sum, set) => sum + (set.actualDistance ?? 0), 0);
}

function sumCardioPerSetDurations(exercise: LoggedWorkoutExercise): number {
  return (exercise.actualCardioPerSets ?? []).reduce((sum, set) => sum + (set.actualDuration ?? 0), 0);
}

/** Session distance and duration totals for pace (distance ÷ duration). */
function cardioSessionPaceInputs(exercise: LoggedWorkoutExercise): {
  distance: number;
  duration: number;
  distanceUnit: LoggedWorkoutExercise['distanceUnit'];
  durationUnit: DurationUnit;
} | null {
  if (exercise.activityType !== 'cardio') {
    return null;
  }

  let distance = exercise.actualDistance;
  let duration = exercise.actualDuration;

  if (getCardioLogLayout(exercise) === 'per_segment') {
    if (isCardioDurationPerDistance(exercise)) {
      duration = sumCardioPerSetDurations(exercise);
    } else if (isCardioDistancePerDuration(exercise)) {
      distance = sumCardioPerSetDistances(exercise);
    }
  }

  if (distance <= 0 || duration <= 0) {
    return null;
  }

  return {
    distance,
    duration,
    distanceUnit: exercise.actualDistanceUnit,
    durationUnit: exercise.actualDurationUnit,
  };
}

function averageRatios(ratios: number[]): number | null {
  if (ratios.length === 0) {
    return null;
  }
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

const CARDIO_OBJECTIVE_EXECUTION_WEIGHT = 0.5;
const CARDIO_PACE_EXECUTION_WEIGHT = 0.5;

function cardioObjectiveExecutionRatio(exercise: LoggedWorkoutExercise): number | null {
  const plan = normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' });
  if (plan.cardioObjective === 'distance') {
    if (exercise.distance > 0 && exercise.actualDistance > 0) {
      return exercise.actualDistance / exercise.distance;
    }
    return null;
  }
  if (exercise.duration > 0 && exercise.actualDuration > 0) {
    return exercise.actualDuration / exercise.duration;
  }
  return null;
}

function weightedObjectiveAndPaceExecution(
  objectiveRatio: number | null,
  paceRatio: number | null,
): number | null {
  if (objectiveRatio !== null && paceRatio !== null) {
    return (
      CARDIO_OBJECTIVE_EXECUTION_WEIGHT * objectiveRatio + CARDIO_PACE_EXECUTION_WEIGHT * paceRatio
    );
  }
  return null;
}

/** Pace = distance ÷ duration; execution = actual pace ÷ planned pace. */
function cardioPaceExecutionRatio(
  actualDistance: number,
  actualDuration: number,
  plannedDistance: number,
  plannedDuration: number,
): number | null {
  if (
    actualDistance <= 0 ||
    actualDuration <= 0 ||
    plannedDistance <= 0 ||
    plannedDuration <= 0
  ) {
    return null;
  }
  const actualPace = actualDistance / actualDuration;
  const plannedPace = plannedDistance / plannedDuration;
  if (!Number.isFinite(actualPace) || !Number.isFinite(plannedPace) || plannedPace <= 0) {
    return null;
  }
  const ratio = actualPace / plannedPace;
  return Number.isFinite(ratio) ? ratio : null;
}

function perSegmentUnitSize(
  setIndex: number,
  segmentCount: number,
  objectiveTotal: number,
  usesIntegerUnits: boolean,
): number {
  const fullUnits = Math.floor(objectiveTotal);
  const hasPartial = !usesIntegerUnits && objectiveTotal - fullUnits > 1e-9;
  const isLastPartial = hasPartial && setIndex === segmentCount - 1;
  if (isLastPartial) {
    return objectiveTotal - fullUnits;
  }
  return 1;
}

function perSegmentObjectiveTotalForExecution(exercise: LoggedWorkoutExercise): number {
  if (isCardioDurationPerDistance(exercise)) {
    if (exercise.actualDistance > 0) {
      return exercise.actualDistance;
    }
    return exercise.distance > 0 ? exercise.distance : 1;
  }
  if (exercise.actualDuration > 0) {
    return exercise.actualDuration;
  }
  return exercise.duration > 0 ? exercise.duration : 1;
}

function cardioPerSegmentExerciseShape(exercise: LoggedWorkoutExercise): CardioPerSegmentExercise {
  return {
    activityType: exercise.activityType,
    cardioObjective: exercise.cardioObjective,
    cardioDurationTracking: exercise.cardioDurationTracking,
    cardioDistanceTracking: exercise.cardioDistanceTracking,
    cardioDistanceMode: exercise.cardioDistanceMode,
    distance: exercise.distance,
    duration: exercise.duration,
    durationUnit: exercise.durationUnit,
    distanceUnit: exercise.distanceUnit,
  };
}

function cardioPerSegmentExecutionRatio(exercise: LoggedWorkoutExercise): number | null {
  const sets = exercise.actualCardioPerSets ?? [];
  if (sets.length === 0) {
    return null;
  }

  const objectiveRatio = cardioObjectiveExecutionRatio(exercise);
  const paceRatios: number[] = [];

  const objectiveTotal = perSegmentObjectiveTotalForExecution(exercise);
  const usesInteger = cardioPerSegmentUsesIntegerObjectiveUnits(cardioPerSegmentExerciseShape(exercise));
  const segmentCount = sets.length;

  for (let setIndex = 0; setIndex < sets.length; setIndex++) {
    const set = sets[setIndex];
    const unitSize = perSegmentUnitSize(setIndex, segmentCount, objectiveTotal, usesInteger);

    if (isCardioDurationPerDistance(exercise)) {
      if (set.actualDuration <= 0 || exercise.duration <= 0) {
        continue;
      }
      const plannedSegmentDuration = exercise.duration * unitSize;
      const ratio = cardioPaceExecutionRatio(
        unitSize,
        set.actualDuration,
        unitSize,
        plannedSegmentDuration,
      );
      if (ratio !== null) {
        paceRatios.push(ratio);
      }
    } else if (isCardioDistancePerDuration(exercise)) {
      if (set.actualDistance <= 0 || exercise.distance <= 0) {
        continue;
      }
      const plannedSegmentDistance = exercise.distance * unitSize;
      const ratio = cardioPaceExecutionRatio(
        set.actualDistance,
        unitSize,
        plannedSegmentDistance,
        unitSize,
      );
      if (ratio !== null) {
        paceRatios.push(ratio);
      }
    }
  }

  return weightedObjectiveAndPaceExecution(objectiveRatio, averageRatios(paceRatios));
}

function forEachLoggedAppearance(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  visit: (exercise: LoggedWorkoutExercise, createdAt: string) => void,
): void {
  forEachLoggedExerciseForTarget(logged, target, visit);
}

export function parseNumericScore(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number.parseFloat(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function sumStretchSetDurations(
  sets: Array<{ duration?: number; durationUnit?: DurationUnit; actualDuration?: number; actualDurationUnit?: DurationUnit }>,
): number {
  if (sets.length === 0) {
    return 0;
  }
  return sets.reduce((sum, set) => {
    const duration = set.duration ?? set.actualDuration ?? 0;
    return sum + duration;
  }, 0);
}

export function cardioSessionExecutionRatio(exercise: LoggedWorkoutExercise): number | null {
  if (exercise.activityType !== 'cardio' || !hasLoggedExerciseActual(exercise)) {
    return null;
  }

  const layout = getCardioLogLayout(exercise);
  const plan = normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' });

  if (layout === 'per_segment') {
    return cardioPerSegmentExecutionRatio(exercise);
  }

  if (layout === 'total') {
    return weightedObjectiveAndPaceExecution(
      cardioObjectiveExecutionRatio(exercise),
      cardioPaceExecutionRatio(
        exercise.actualDistance,
        exercise.actualDuration,
        exercise.distance,
        exercise.duration,
      ),
    );
  }

  if (plan.cardioObjective === 'distance') {
    if (exercise.distance > 0 && exercise.actualDistance > 0) {
      return exercise.actualDistance / exercise.distance;
    }
  } else if (exercise.duration > 0 && exercise.actualDuration > 0) {
    return exercise.actualDuration / exercise.duration;
  }
  return null;
}

export function sportSessionExecutionRatio(exercise: LoggedWorkoutExercise): number | null {
  if (exercise.activityType !== 'sport' || !hasLoggedExerciseActual(exercise)) {
    return null;
  }

  const ratios: number[] = [];
  if (exercise.duration > 0 && exercise.actualDuration > 0) {
    ratios.push(exercise.actualDuration / exercise.duration);
  }
  const plannedScore = parseNumericScore(exercise.score);
  const actualScore = parseNumericScore(exercise.actualScore);
  if (plannedScore !== null && plannedScore > 0 && actualScore !== null) {
    ratios.push(actualScore / plannedScore);
  }
  if (ratios.length === 0) {
    return null;
  }
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

export function stretchSessionExecutionRatio(exercise: LoggedWorkoutExercise): number | null {
  if (exercise.activityType !== 'stretch' || exercise.actualStretchSets.length === 0) {
    return null;
  }

  const plannedSets = readStretchSetsFromExercise(exercise);
  const plannedTotal = sumStretchSetDurations(plannedSets);
  const actualTotal = sumStretchSetDurations(exercise.actualStretchSets);
  if (plannedTotal <= 0 || actualTotal <= 0) {
    return null;
  }
  return actualTotal / plannedTotal;
}

function sessionExecutionRatioForType(exercise: LoggedWorkoutExercise): number | null {
  switch (exercise.activityType) {
    case 'cardio':
      return cardioSessionExecutionRatio(exercise);
    case 'sport':
      return sportSessionExecutionRatio(exercise);
    case 'stretch':
      return stretchSessionExecutionRatio(exercise);
    default:
      return null;
  }
}

export function getActivityExecutionSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activityType: ActivityType,
): SessionExecutionSnapshot[] {
  const out: SessionExecutionSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== activityType) {
      return;
    }
    const ratio = sessionExecutionRatioForType(exercise);
    if (ratio === null || !Number.isFinite(ratio)) {
      return;
    }
    out.push({ createdAt, executionRatio: ratio });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function averageActivityExecutionScorePercent(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activityType: ActivityType,
): number | null {
  const snapshots = getActivityExecutionSnapshots(logged, target, activityType);
  if (snapshots.length === 0) {
    return null;
  }
  const meanRatio = snapshots.reduce((sum, snapshot) => sum + snapshot.executionRatio, 0) / snapshots.length;
  return meanRatio * 100;
}

export function getCardioDistanceSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SessionValueSnapshot[] {
  const out: SessionValueSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== 'cardio' || exercise.actualDistance <= 0 || exercise.distance <= 0) {
      return;
    }
    const executionRatio = exercise.actualDistance / exercise.distance;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: exercise.actualDistance,
      planned: exercise.distance,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function getCardioDurationSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SessionValueSnapshot[] {
  const out: SessionValueSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== 'cardio' || exercise.actualDuration <= 0 || exercise.duration <= 0) {
      return;
    }
    const executionRatio = exercise.actualDuration / exercise.duration;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: exercise.actualDuration,
      planned: exercise.duration,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function getSportDurationSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SessionValueSnapshot[] {
  const out: SessionValueSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== 'sport' || exercise.actualDuration <= 0 || exercise.duration <= 0) {
      return;
    }
    const executionRatio = exercise.actualDuration / exercise.duration;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: exercise.actualDuration,
      planned: exercise.duration,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function getSportScoreSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SessionValueSnapshot[] {
  const out: SessionValueSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== 'sport') {
      return;
    }
    const planned = parseNumericScore(exercise.score);
    const actual = parseNumericScore(exercise.actualScore);
    if (planned === null || planned <= 0 || actual === null) {
      return;
    }
    const executionRatio = actual / planned;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual,
      planned,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function getStretchTotalDurationSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SessionValueSnapshot[] {
  const out: SessionValueSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== 'stretch' || exercise.actualStretchSets.length === 0) {
      return;
    }
    const plannedTotal = sumStretchSetDurations(readStretchSetsFromExercise(exercise));
    const actualTotal = sumStretchSetDurations(exercise.actualStretchSets);
    if (plannedTotal <= 0 || actualTotal <= 0) {
      return;
    }
    const executionRatio = actualTotal / plannedTotal;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: actualTotal,
      planned: plannedTotal,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function getCardioPersonalRecords(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): CardioPersonalRecords {
  let maxDistance: number | null = null;
  let maxDistanceUnit: LoggedWorkoutExercise['distanceUnit'] | null = null;
  let maxDuration: number | null = null;
  let maxDurationUnit: DurationUnit | null = null;
  let bestPaceDistancePerDuration: number | null = null;
  let bestPaceDistanceUnit: LoggedWorkoutExercise['distanceUnit'] | null = null;
  let bestPaceDurationUnit: DurationUnit | null = null;

  forEachLoggedAppearance(logged, target, (exercise) => {
    if (exercise.activityType !== 'cardio') {
      return;
    }
    if (exercise.actualDistance > 0) {
      if (maxDistance === null || exercise.actualDistance > maxDistance) {
        maxDistance = exercise.actualDistance;
        maxDistanceUnit = exercise.actualDistanceUnit;
      }
    }
    if (exercise.actualDuration > 0) {
      if (maxDuration === null || exercise.actualDuration > maxDuration) {
        maxDuration = exercise.actualDuration;
        maxDurationUnit = exercise.actualDurationUnit;
      }
    }
    const paceInputs = cardioSessionPaceInputs(exercise);
    if (paceInputs) {
      const pace = paceInputs.distance / paceInputs.duration;
      if (
        Number.isFinite(pace) &&
        (bestPaceDistancePerDuration === null || pace > bestPaceDistancePerDuration)
      ) {
        bestPaceDistancePerDuration = pace;
        bestPaceDistanceUnit = paceInputs.distanceUnit;
        bestPaceDurationUnit = paceInputs.durationUnit;
      }
    }
  });

  return {
    maxDistance,
    maxDistanceUnit,
    maxDuration,
    maxDurationUnit,
    bestPaceDistancePerDuration,
    bestPaceDistanceUnit,
    bestPaceDurationUnit,
  };
}

export function getSportPersonalRecords(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SportPersonalRecords {
  let maxDuration: number | null = null;
  let maxDurationUnit: DurationUnit | null = null;
  let maxNumericScore: number | null = null;
  let maxScoreUnit: ScoreUnit | null = null;
  let bestScoreLabel: string | null = null;

  forEachLoggedAppearance(logged, target, (exercise) => {
    if (exercise.activityType !== 'sport') {
      return;
    }
    if (exercise.actualDuration > 0) {
      if (maxDuration === null || exercise.actualDuration > maxDuration) {
        maxDuration = exercise.actualDuration;
        maxDurationUnit = exercise.actualDurationUnit;
      }
    }
    const actualScore = parseNumericScore(exercise.actualScore);
    if (actualScore !== null) {
      if (maxNumericScore === null || actualScore > maxNumericScore) {
        maxNumericScore = actualScore;
        maxScoreUnit = exercise.actualScoreUnit;
        bestScoreLabel = formatScoreWithUnit(exercise.actualScore, exercise.actualScoreUnit);
      }
    }
  });

  return {
    maxDuration,
    maxDurationUnit,
    maxNumericScore,
    maxScoreUnit,
    bestScoreLabel,
  };
}

export function getStretchPersonalRecords(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): StretchPersonalRecords {
  let maxSingleSetDuration: number | null = null;
  let maxSingleSetUnit: DurationUnit | null = null;
  let maxSetsInSession: number | null = null;
  let maxTotalSessionDuration: number | null = null;
  let maxTotalSessionUnit: DurationUnit | null = null;

  forEachLoggedAppearance(logged, target, (exercise) => {
    if (exercise.activityType !== 'stretch' || exercise.actualStretchSets.length === 0) {
      return;
    }
    const setCount = exercise.actualStretchSets.length;
    maxSetsInSession = maxSetsInSession === null ? setCount : Math.max(maxSetsInSession, setCount);

    for (const set of exercise.actualStretchSets) {
      if (set.actualDuration > 0) {
        if (maxSingleSetDuration === null || set.actualDuration > maxSingleSetDuration) {
          maxSingleSetDuration = set.actualDuration;
          maxSingleSetUnit = set.actualDurationUnit;
        }
      }
    }

    const sessionTotal = sumStretchSetDurations(exercise.actualStretchSets);
    if (sessionTotal > 0) {
      if (maxTotalSessionDuration === null || sessionTotal > maxTotalSessionDuration) {
        maxTotalSessionDuration = sessionTotal;
        maxTotalSessionUnit = exercise.actualStretchSets[0]?.actualDurationUnit ?? null;
      }
    }
  });

  return {
    maxSingleSetDuration,
    maxSingleSetUnit,
    maxSetsInSession,
    maxTotalSessionDuration,
    maxTotalSessionUnit,
  };
}

export function getCardioLifetimeDistance(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): number {
  let total = 0;
  forEachLoggedAppearance(logged, target, (exercise) => {
    if (exercise.activityType === 'cardio' && exercise.actualDistance > 0) {
      total += exercise.actualDistance;
    }
  });
  return total;
}

export function getStretchLifetimeDuration(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): number {
  let total = 0;
  forEachLoggedAppearance(logged, target, (exercise) => {
    if (exercise.activityType === 'stretch') {
      total += sumStretchSetDurations(exercise.actualStretchSets);
    }
  });
  return total;
}

export function latestLoggedExercise(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): LoggedWorkoutExercise | null {
  let bestTime = -Infinity;
  let bestExercise: LoggedWorkoutExercise | null = null;
  forEachLoggedExerciseForTarget(logged, target, (exercise, createdAt) => {
    const t = new Date(createdAt).getTime();
    if (Number.isFinite(t) && t >= bestTime) {
      bestTime = t;
      bestExercise = exercise;
    }
  });
  return bestExercise;
}

export function formatCardioPrDistance(value: number | null, unit: LoggedWorkoutExercise['distanceUnit'] | null): string {
  if (value === null || unit === null) {
    return '—';
  }
  return formatCardioDistanceWithUnit(value, unit) || '—';
}

export function formatDurationPr(value: number | null, unit: DurationUnit | null): string {
  if (value === null || unit === null) {
    return '—';
  }
  return formatDurationWithUnit(value, unit) || '—';
}

export function formatCardioPacePr(
  paceDistancePerDuration: number | null,
  distanceUnit: LoggedWorkoutExercise['distanceUnit'] | null,
  durationUnit: DurationUnit | null,
): string {
  if (paceDistancePerDuration === null || distanceUnit === null || durationUnit === null) {
    return '—';
  }
  const distanceLabel = formatCardioDistanceWithUnit(paceDistancePerDuration, distanceUnit);
  if (!distanceLabel) {
    return '—';
  }
  return `${distanceLabel} / ${DURATION_UNIT_ABBREVIATIONS[durationUnit]}`;
}

export function formatSportScorePr(
  value: number | null,
  unit: ScoreUnit | null,
  fallbackLabel: string | null,
): string {
  if (fallbackLabel) {
    return fallbackLabel;
  }
  if (value === null || unit === null) {
    return '—';
  }
  const rounded = Math.abs(value % 1) < 1e-9 ? String(Math.round(value)) : formatDisplayDecimal(value, DISPLAY_DECIMAL_PLACES);
  return `${rounded} ${SCORE_UNIT_ABBREVIATIONS[unit]}`;
}
