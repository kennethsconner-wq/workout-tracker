import type { ActivityType } from '@/lib/activityTypes';
import {
  convertCardioDistance,
  formatCardioDistanceWithUnit,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  getCardioLogLayout,
  isCardioDistancePerDuration,
  isCardioDurationPerDistance,
  isCardioPaceTracking,
  normalizeCardioPlanFields,
  plannedDurationForObjectiveDistanceChunk,
  readCardioPacePlan,
  formatCardioPaceSummary,
  type CardioPacePlan,
} from '@/lib/cardioPlan';
import {
  cardioPerSegmentUsesIntegerObjectiveUnits,
  type CardioPerSegmentExercise,
} from '@/lib/cardioPerLog';
import {
  durationToSeconds,
  formatDurationWithUnit,
  secondsToDurationValue,
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
import type { LoggedWorkout, LoggedWorkoutExercise, Workout, WorkoutExercise } from '@/lib/types';

export type SessionValueSnapshot = {
  createdAt: string;
  actual: number;
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
  /** Fastest session time per planned pace distance chunk (duration per distance). */
  bestPaceDuration: number | null;
  bestPaceDurationUnit: DurationUnit | null;
  bestPaceDistance: number | null;
  bestPaceDistanceUnit: LoggedWorkoutExercise['distanceUnit'] | null;
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

function sumCardioPerSetDurationsInSeconds(exercise: LoggedWorkoutExercise): number {
  return (exercise.actualCardioPerSets ?? []).reduce((sum, set) => {
    const seconds = durationToSeconds(set.actualDuration, set.actualDurationUnit);
    return sum + (seconds ?? 0);
  }, 0);
}

function cardioEffectiveSessionDuration(
  exercise: LoggedWorkoutExercise,
): { duration: number; durationUnit: DurationUnit } | null {
  if (exercise.actualDuration > 0) {
    return { duration: exercise.actualDuration, durationUnit: exercise.actualDurationUnit };
  }
  if (getCardioLogLayout(exercise) !== 'per_segment' || !isCardioDurationPerDistance(exercise)) {
    return null;
  }
  const pace = readCardioPacePlan(exercise);
  const totalSeconds = sumCardioPerSetDurationsInSeconds(exercise);
  if (!pace || totalSeconds <= 0) {
    return null;
  }
  const duration = secondsToDurationValue(totalSeconds, pace.durationUnit);
  if (duration === null) {
    return null;
  }
  return { duration, durationUnit: pace.durationUnit };
}

/** Session distance and duration totals used to derive best pace. */
function cardioSessionPaceInputs(exercise: LoggedWorkoutExercise): {
  distance: number;
  duration: number;
  distanceUnit: LoggedWorkoutExercise['distanceUnit'];
  durationUnit: DurationUnit;
} | null {
  if (exercise.activityType !== 'cardio') {
    return null;
  }

  const layout = getCardioLogLayout(exercise);
  const pace = readCardioPacePlan(exercise);

  if (layout === 'per_segment' && isCardioPaceTracking(exercise) && pace && pace.duration > 0 && pace.distance > 0) {
    const sets = exercise.actualCardioPerSets ?? [];
    if (sets.length === 0) {
      return null;
    }

    const totalDurationSeconds = sumCardioPerSetDurationsInSeconds(exercise);
    if (totalDurationSeconds <= 0) {
      return null;
    }

    const duration = secondsToDurationValue(totalDurationSeconds, pace.durationUnit);
    if (duration === null) {
      return null;
    }

    let distanceInPaceUnit =
      cardioSumSegmentDistancesInPaceUnits(exercise, {
        onlyLoggedSegments: true,
        objectiveSource: 'actual',
      }) ??
      cardioSumSegmentDistancesInPaceUnits(exercise, {
        onlyLoggedSegments: true,
        objectiveSource: 'planned',
      });

    if (distanceInPaceUnit === null && isCardioDurationPerDistance(exercise)) {
      const objectiveDistance =
        exercise.actualDistance > 0 ? exercise.actualDistance : exercise.distance > 0 ? exercise.distance : 0;
      const objectiveDistanceUnit =
        exercise.actualDistance > 0 ? exercise.actualDistanceUnit : exercise.distanceUnit;
      if (objectiveDistance > 0) {
        distanceInPaceUnit = convertCardioDistance(objectiveDistance, objectiveDistanceUnit, pace.distanceUnit);
        if (distanceInPaceUnit === null && objectiveDistanceUnit === pace.distanceUnit) {
          distanceInPaceUnit = objectiveDistance;
        }
      }
    } else if (distanceInPaceUnit === null) {
      const objectiveDuration =
        exercise.actualDuration > 0 ? exercise.actualDuration : exercise.duration > 0 ? exercise.duration : 0;
      const objectiveDurationUnit =
        exercise.actualDuration > 0 ? exercise.actualDurationUnit : exercise.durationUnit;
      const paceSeconds = durationToSeconds(pace.duration, pace.durationUnit);
      if (objectiveDuration > 0 && paceSeconds) {
        const objectiveSeconds = durationToSeconds(objectiveDuration, objectiveDurationUnit);
        if (objectiveSeconds) {
          distanceInPaceUnit = (objectiveSeconds / paceSeconds) * pace.distance;
        }
      }
    }

    if (distanceInPaceUnit === null || distanceInPaceUnit <= 0) {
      return null;
    }

    return {
      distance: distanceInPaceUnit,
      duration,
      distanceUnit: pace.distanceUnit,
      durationUnit: pace.durationUnit,
    };
  }

  const distance = exercise.actualDistance;
  const duration = exercise.actualDuration;
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

function cardioDistanceInMeters(distance: number, unit: CardioDistanceUnit): number | null {
  return convertCardioDistance(distance, unit, 'meters');
}

/** Planned session distance (objective distance or duration × pace, including partial segments). */
function cardioPlannedSessionDistance(exercise: LoggedWorkoutExercise): {
  distance: number;
  distanceUnit: LoggedWorkoutExercise['distanceUnit'];
} | null {
  const pace = readCardioPacePlan(exercise);
  const fromSegments =
    pace &&
    cardioSumSegmentDistancesInPaceUnits(exercise, {
      onlyLoggedSegments: false,
      objectiveSource: 'planned',
    });

  if (fromSegments !== null && fromSegments > 0) {
    return { distance: fromSegments, distanceUnit: pace!.distanceUnit };
  }

  if (exercise.distance > 0) {
    return { distance: exercise.distance, distanceUnit: exercise.distanceUnit };
  }

  if (!pace || exercise.duration <= 0) {
    return null;
  }

  const durationSeconds = durationToSeconds(exercise.duration, exercise.durationUnit);
  const paceSeconds = durationToSeconds(pace.duration, pace.durationUnit);
  if (!durationSeconds || !paceSeconds) {
    return null;
  }

  const distance = (durationSeconds / paceSeconds) * pace.distance;
  if (!Number.isFinite(distance) || distance <= 0) {
    return null;
  }

  return { distance, distanceUnit: pace.distanceUnit };
}

/** Logged session distance (objective distance or sum of segment chunks including partials). */
function cardioEffectiveSessionDistance(exercise: LoggedWorkoutExercise): {
  distance: number;
  distanceUnit: LoggedWorkoutExercise['distanceUnit'];
} | null {
  if (exercise.actualDistance > 0) {
    return { distance: exercise.actualDistance, distanceUnit: exercise.actualDistanceUnit };
  }

  const pace = readCardioPacePlan(exercise);
  const fromLoggedSegments =
    pace &&
    cardioSumSegmentDistancesInPaceUnits(exercise, {
      onlyLoggedSegments: true,
      objectiveSource: 'actual',
    });

  if (fromLoggedSegments !== null && fromLoggedSegments > 0) {
    return { distance: fromLoggedSegments, distanceUnit: pace!.distanceUnit };
  }

  if (pace && pace.duration > 0 && pace.distance > 0 && isCardioDistancePerDuration(exercise)) {
    const paceSeconds = durationToSeconds(pace.duration, pace.durationUnit);
    if (paceSeconds) {
      const objectiveDuration =
        exercise.actualDuration > 0 ? exercise.actualDuration : exercise.duration > 0 ? exercise.duration : 0;
      const objectiveDurationUnit =
        exercise.actualDuration > 0 ? exercise.actualDurationUnit : exercise.durationUnit;
      if (objectiveDuration > 0) {
        const objectiveSeconds = durationToSeconds(objectiveDuration, objectiveDurationUnit);
        if (objectiveSeconds) {
          const distance = (objectiveSeconds / paceSeconds) * pace.distance;
          if (Number.isFinite(distance) && distance > 0) {
            return { distance, distanceUnit: pace.distanceUnit };
          }
        }
      }
    }
  }

  const paceTotals = cardioSessionPaceInputs(exercise);
  if (paceTotals && paceTotals.distance > 0) {
    return { distance: paceTotals.distance, distanceUnit: paceTotals.distanceUnit };
  }

  return null;
}

function cardioDistanceIsGreater(
  distance: number,
  distanceUnit: LoggedWorkoutExercise['distanceUnit'],
  maxDistance: number | null,
  maxDistanceUnit: LoggedWorkoutExercise['distanceUnit'] | null,
): boolean {
  if (maxDistance === null || maxDistanceUnit === null) {
    return true;
  }

  const candidateMeters = cardioDistanceInMeters(distance, distanceUnit);
  const maxMeters = cardioDistanceInMeters(maxDistance, maxDistanceUnit);
  if (candidateMeters !== null && maxMeters !== null) {
    return candidateMeters > maxMeters;
  }

  if (distanceUnit === maxDistanceUnit) {
    return distance > maxDistance;
  }

  return false;
}

function addCardioDistanceToTotal(
  total: number,
  totalUnit: CardioDistanceUnit | null,
  distance: number,
  distanceUnit: CardioDistanceUnit,
): { total: number; totalUnit: CardioDistanceUnit | null } {
  if (totalUnit === null) {
    return { total: distance, totalUnit: distanceUnit };
  }

  const converted = convertCardioDistance(distance, distanceUnit, totalUnit);
  if (converted !== null) {
    return { total: total + converted, totalUnit };
  }

  if (distanceUnit === totalUnit) {
    return { total: total + distance, totalUnit };
  }

  return { total, totalUnit };
}

/** Distance unit for formatting cardio metrics when objective distance is not logged. */
export function cardioMetricDisplayDistanceUnit(
  exercise: LoggedWorkoutExercise | null,
): LoggedWorkoutExercise['distanceUnit'] {
  if (!exercise) {
    return 'miles';
  }
  if (exercise.actualDistance > 0) {
    return exercise.actualDistanceUnit;
  }
  if (exercise.distance > 0) {
    return exercise.distanceUnit;
  }
  const pace = readCardioPacePlan(exercise);
  if (pace) {
    return pace.distanceUnit;
  }
  return exercise.distanceUnit;
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

function perSegmentObjectiveChunkTotal(
  exercise: LoggedWorkoutExercise,
  source: 'actual' | 'planned',
): number {
  if (isCardioDurationPerDistance(exercise)) {
    if (source === 'actual' && exercise.actualDistance > 0) {
      return exercise.actualDistance;
    }
    return exercise.distance > 0 ? exercise.distance : 0;
  }

  const pace = readCardioPacePlan(exercise);
  const durationTotal =
    source === 'actual' && exercise.actualDuration > 0
      ? exercise.actualDuration
      : exercise.duration > 0
        ? exercise.duration
        : 0;
  const durationUnit =
    source === 'actual' && exercise.actualDuration > 0
      ? exercise.actualDurationUnit
      : exercise.durationUnit;
  if (durationTotal <= 0 || !pace || pace.duration <= 0) {
    return 0;
  }

  const objectiveSeconds = durationToSeconds(durationTotal, durationUnit);
  const paceSeconds = durationToSeconds(pace.duration, pace.durationUnit);
  if (!objectiveSeconds || !paceSeconds) {
    return durationTotal / pace.duration;
  }
  return objectiveSeconds / paceSeconds;
}

function perSegmentObjectiveTotalForExecution(exercise: LoggedWorkoutExercise): number {
  const actualTotal = perSegmentObjectiveChunkTotal(exercise, 'actual');
  if (actualTotal > 0) {
    return actualTotal;
  }
  const plannedTotal = perSegmentObjectiveChunkTotal(exercise, 'planned');
  if (plannedTotal > 0) {
    return plannedTotal;
  }
  return 1;
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
    cardioPaceDuration: exercise.cardioPaceDuration,
    cardioPaceDurationUnit: exercise.cardioPaceDurationUnit,
    cardioPaceDistance: exercise.cardioPaceDistance,
    cardioPaceDistanceUnit: exercise.cardioPaceDistanceUnit,
  };
}

/** Sum segment distances (including partial final chunks) for per-segment pace logging. */
function cardioSumSegmentDistancesInPaceUnits(
  exercise: LoggedWorkoutExercise,
  options: { onlyLoggedSegments: boolean; objectiveSource: 'actual' | 'planned' },
): number | null {
  const pace = readCardioPacePlan(exercise);
  if (
    !pace ||
    pace.distance <= 0 ||
    getCardioLogLayout(exercise) !== 'per_segment' ||
    !isCardioPaceTracking(exercise)
  ) {
    return null;
  }

  const sets = exercise.actualCardioPerSets ?? [];
  if (sets.length === 0) {
    return null;
  }

  const objectiveTotal = perSegmentObjectiveChunkTotal(exercise, options.objectiveSource);
  if (objectiveTotal <= 0) {
    return null;
  }

  const usesInteger = cardioPerSegmentUsesIntegerObjectiveUnits(cardioPerSegmentExerciseShape(exercise));
  const segmentCount = sets.length;
  let total = 0;

  for (let setIndex = 0; setIndex < sets.length; setIndex++) {
    const set = sets[setIndex];
    if (options.onlyLoggedSegments && set.actualDuration <= 0) {
      continue;
    }
    const unitSize = perSegmentUnitSize(setIndex, segmentCount, objectiveTotal, usesInteger);
    total += segmentDistanceInPaceUnits(exercise, pace, unitSize);
  }

  return total > 0 ? total : null;
}

/** Distance covered by one logged pace segment, in pace distance units. */
function segmentDistanceInPaceUnits(
  exercise: LoggedWorkoutExercise,
  pace: CardioPacePlan,
  unitSize: number,
): number {
  if (unitSize <= 0) {
    return 0;
  }
  if (isCardioDurationPerDistance(exercise)) {
    const converted = convertCardioDistance(unitSize, exercise.distanceUnit, pace.distanceUnit);
    if (converted !== null) {
      return converted;
    }
    if (exercise.distanceUnit === pace.distanceUnit) {
      return unitSize;
    }
    return 0;
  }
  return unitSize * pace.distance;
}

/** Scale a segment time to duration per full planned pace distance chunk. */
function durationSecondsPerPaceChunk(
  actualSeconds: number,
  segmentDistanceInPaceUnits: number,
  pace: CardioPacePlan,
): number | null {
  if (actualSeconds <= 0 || segmentDistanceInPaceUnits <= 0 || pace.distance <= 0) {
    return null;
  }
  const normalized = actualSeconds * (pace.distance / segmentDistanceInPaceUnits);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

/** Fastest logged pace chunk in this appearance (per-segment when applicable). */
function cardioBestLoggedPaceSample(exercise: LoggedWorkoutExercise): {
  duration: number;
  durationUnit: DurationUnit;
  distance: number;
  distanceUnit: LoggedWorkoutExercise['distanceUnit'];
} | null {
  const pace = readCardioPacePlan(exercise);
  if (!pace || pace.duration <= 0 || pace.distance <= 0) {
    return cardioSessionDurationPerPaceChunk(exercise);
  }

  const layout = getCardioLogLayout(exercise);
  if (layout === 'per_segment' && isCardioPaceTracking(exercise)) {
    const sets = exercise.actualCardioPerSets ?? [];
    if (sets.length === 0) {
      return null;
    }

    const objectiveTotal = perSegmentObjectiveTotalForExecution(exercise);
    const usesInteger = cardioPerSegmentUsesIntegerObjectiveUnits(cardioPerSegmentExerciseShape(exercise));
    const segmentCount = sets.length;

    let bestSeconds: number | null = null;
    let bestDuration: number | null = null;
    let bestSegmentDistance: number | null = null;

    for (let setIndex = 0; setIndex < sets.length; setIndex++) {
      const set = sets[setIndex];
      if (set.actualDuration <= 0) {
        continue;
      }
      const actualSeconds = durationToSeconds(set.actualDuration, set.actualDurationUnit);
      if (!actualSeconds) {
        continue;
      }
      const unitSize = perSegmentUnitSize(setIndex, segmentCount, objectiveTotal, usesInteger);
      const segmentDistance = segmentDistanceInPaceUnits(exercise, pace, unitSize);
      const normalizedSeconds = durationSecondsPerPaceChunk(actualSeconds, segmentDistance, pace);
      if (!normalizedSeconds) {
        continue;
      }
      const displayDuration = secondsToDurationValue(actualSeconds, pace.durationUnit);
      if (displayDuration === null) {
        continue;
      }
      if (bestSeconds === null || normalizedSeconds < bestSeconds) {
        bestSeconds = normalizedSeconds;
        bestDuration = displayDuration;
        bestSegmentDistance = segmentDistance;
      }
    }

    if (bestSeconds === null || bestDuration === null || bestSegmentDistance === null) {
      return null;
    }

    return {
      duration: bestDuration,
      durationUnit: pace.durationUnit,
      distance: bestSegmentDistance,
      distanceUnit: pace.distanceUnit,
    };
  }

  return cardioSessionDurationPerPaceChunk(exercise);
}

/** Actual session time per planned pace distance chunk (lower = faster). */
function cardioSessionDurationPerPaceChunk(exercise: LoggedWorkoutExercise): {
  duration: number;
  durationUnit: DurationUnit;
  distance: number;
  distanceUnit: LoggedWorkoutExercise['distanceUnit'];
} | null {
  const totals = cardioSessionPaceInputs(exercise);
  if (!totals || totals.distance <= 0 || totals.duration <= 0) {
    return null;
  }

  const pace = readCardioPacePlan(exercise);
  const chunkDistance = pace && pace.distance > 0 ? pace.distance : 1;
  const chunkDistanceUnit = pace?.distanceUnit ?? totals.distanceUnit;
  const durationUnit = pace?.durationUnit ?? totals.durationUnit;
  const durationPerChunk = (totals.duration / totals.distance) * chunkDistance;
  if (!Number.isFinite(durationPerChunk) || durationPerChunk <= 0) {
    return null;
  }

  return {
    duration: durationPerChunk,
    durationUnit,
    distance: chunkDistance,
    distanceUnit: chunkDistanceUnit,
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

/** Speed = distance ÷ duration; execution = actual speed ÷ planned speed (same as planned duration ÷ actual duration per chunk). */
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

    if (isCardioPaceTracking(exercise)) {
      if (set.actualDuration <= 0) {
        continue;
      }
      const pace = readCardioPacePlan(exercise);
      if (!pace || pace.duration <= 0) {
        continue;
      }
      const plannedSegmentDuration = isCardioDurationPerDistance(exercise)
        ? plannedDurationForObjectiveDistanceChunk(pace, unitSize, exercise.distanceUnit) ?? pace.duration
        : unitSize * pace.duration;
      const plannedSeconds = durationToSeconds(plannedSegmentDuration, pace.durationUnit);
      const actualSeconds = durationToSeconds(set.actualDuration, set.actualDurationUnit);
      if (!plannedSeconds || !actualSeconds) {
        continue;
      }
      const ratio = plannedSeconds / actualSeconds;
      if (Number.isFinite(ratio)) {
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
    if (exercise.activityType !== 'cardio') {
      return;
    }
    const actual = cardioEffectiveSessionDistance(exercise);
    if (!actual || actual.distance <= 0) {
      return;
    }

    let executionRatio = 1;
    const planned = cardioPlannedSessionDistance(exercise);
    if (planned && planned.distance > 0) {
      const actualInPlannedUnit =
        convertCardioDistance(actual.distance, actual.distanceUnit, planned.distanceUnit) ??
        (actual.distanceUnit === planned.distanceUnit ? actual.distance : null);
      if (actualInPlannedUnit !== null && actualInPlannedUnit > 0) {
        executionRatio = actualInPlannedUnit / planned.distance;
      }
    }
    if (!Number.isFinite(executionRatio)) {
      return;
    }

    out.push({
      createdAt,
      actual: actual.distance,
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
    if (exercise.activityType !== 'cardio') {
      return;
    }
    const actual = cardioEffectiveSessionDuration(exercise);
    if (!actual || actual.duration <= 0) {
      return;
    }
    let executionRatio = 1;
    if (exercise.duration > 0) {
      const actualSeconds = durationToSeconds(actual.duration, actual.durationUnit);
      const plannedSeconds = durationToSeconds(exercise.duration, exercise.durationUnit);
      if (actualSeconds && plannedSeconds) {
        executionRatio = actualSeconds / plannedSeconds;
      }
    }
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: actual.duration,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function getCardioPaceSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SessionValueSnapshot[] {
  const out: SessionValueSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== 'cardio' || !isCardioPaceTracking(exercise)) {
      return;
    }
    const paceSample = cardioSessionDurationPerPaceChunk(exercise);
    if (!paceSample || paceSample.duration <= 0) {
      return;
    }
    let executionRatio = 1;
    const pace = readCardioPacePlan(exercise);
    if (pace && pace.duration > 0) {
      const plannedSeconds = durationToSeconds(pace.duration, pace.durationUnit);
      const actualSeconds = durationToSeconds(paceSample.duration, paceSample.durationUnit);
      if (plannedSeconds && actualSeconds) {
        executionRatio = plannedSeconds / actualSeconds;
      }
    }
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: paceSample.duration,
      executionRatio,
    });
  });
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

export function cardioPlanReferenceExercise(
  workouts: Workout[],
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): LoggedWorkoutExercise | WorkoutExercise | null {
  const fromLog = latestLoggedExercise(logged, target);
  if (fromLog) {
    return fromLog;
  }
  const ids = new Set(target.workoutExerciseIds);
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      if (ids.has(exercise.id)) {
        return exercise;
      }
    }
  }
  return null;
}

export function getSportDurationSnapshots(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
): SessionValueSnapshot[] {
  const out: SessionValueSnapshot[] = [];
  forEachLoggedAppearance(logged, target, (exercise, createdAt) => {
    if (exercise.activityType !== 'sport' || exercise.actualDuration <= 0) {
      return;
    }
    const executionRatio =
      exercise.duration > 0 ? exercise.actualDuration / exercise.duration : 1;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: exercise.actualDuration,
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
    if (actual === null) {
      return;
    }
    const executionRatio =
      planned !== null && planned > 0 ? actual / planned : 1;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual,
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
    if (actualTotal <= 0) {
      return;
    }
    const executionRatio = plannedTotal > 0 ? actualTotal / plannedTotal : 1;
    if (!Number.isFinite(executionRatio)) {
      return;
    }
    out.push({
      createdAt,
      actual: actualTotal,
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
  let bestPaceDuration: number | null = null;
  let bestPaceDurationUnit: DurationUnit | null = null;
  let bestPaceDistance: number | null = null;
  let bestPaceDistanceUnit: LoggedWorkoutExercise['distanceUnit'] | null = null;
  let bestPaceSeconds: number | null = null;

  forEachLoggedAppearance(logged, target, (exercise) => {
    if (exercise.activityType !== 'cardio') {
      return;
    }
    const sessionDistance = cardioEffectiveSessionDistance(exercise);
    if (sessionDistance && cardioDistanceIsGreater(
      sessionDistance.distance,
      sessionDistance.distanceUnit,
      maxDistance,
      maxDistanceUnit,
    )) {
      maxDistance = sessionDistance.distance;
      maxDistanceUnit = sessionDistance.distanceUnit;
    }
    const sessionDuration = cardioEffectiveSessionDuration(exercise);
    if (sessionDuration) {
      const sessionSeconds = durationToSeconds(sessionDuration.duration, sessionDuration.durationUnit);
      const maxSeconds =
        maxDuration !== null && maxDurationUnit !== null
          ? durationToSeconds(maxDuration, maxDurationUnit)
          : null;
      if (sessionSeconds && (maxSeconds === null || sessionSeconds > maxSeconds)) {
        maxDuration = sessionDuration.duration;
        maxDurationUnit = sessionDuration.durationUnit;
      }
    }
    const paceSample = cardioBestLoggedPaceSample(exercise);
    if (paceSample) {
      const sampleSeconds = durationToSeconds(paceSample.duration, paceSample.durationUnit);
      if (
        sampleSeconds &&
        (bestPaceSeconds === null || sampleSeconds < bestPaceSeconds)
      ) {
        bestPaceSeconds = sampleSeconds;
        bestPaceDuration = paceSample.duration;
        bestPaceDurationUnit = paceSample.durationUnit;
        bestPaceDistance = paceSample.distance;
        bestPaceDistanceUnit = paceSample.distanceUnit;
      }
    }
  });

  return {
    maxDistance,
    maxDistanceUnit,
    maxDuration,
    maxDurationUnit,
    bestPaceDuration,
    bestPaceDurationUnit,
    bestPaceDistance,
    bestPaceDistanceUnit,
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
  let totalUnit: CardioDistanceUnit | null = null;
  forEachLoggedAppearance(logged, target, (exercise) => {
    if (exercise.activityType !== 'cardio') {
      return;
    }
    const sessionDistance = cardioEffectiveSessionDistance(exercise);
    if (!sessionDistance) {
      return;
    }
    const next = addCardioDistanceToTotal(
      total,
      totalUnit,
      sessionDistance.distance,
      sessionDistance.distanceUnit,
    );
    total = next.total;
    totalUnit = next.totalUnit;
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
  duration: number | null,
  durationUnit: DurationUnit | null,
  distance: number | null,
  distanceUnit: LoggedWorkoutExercise['distanceUnit'] | null,
): string {
  if (duration === null || durationUnit === null || distance === null || distanceUnit === null) {
    return '—';
  }
  return (
    formatCardioPaceSummary({
      duration,
      durationUnit,
      distance,
      distanceUnit,
    }) || '—'
  );
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
