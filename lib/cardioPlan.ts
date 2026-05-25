import {
  formatCardioDistanceValue,
  formatCardioDistanceWithUnit,
  formatCardioPerDistanceUnit,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  DURATION_UNIT_ABBREVIATIONS,
  formatDurationValue,
  formatDurationWithUnit,
  normalizeDurationUnit,
  type DurationUnit,
} from '@/lib/durationUnits';
import type { WorkoutExercise } from '@/lib/types';

export const CARDIO_OBJECTIVES = ['distance', 'duration'] as const;
export type CardioObjective = (typeof CARDIO_OBJECTIVES)[number];

export const CARDIO_DURATION_TRACKING_OPTIONS = ['none', 'total', 'per_distance_unit'] as const;
export type CardioDurationTracking = (typeof CARDIO_DURATION_TRACKING_OPTIONS)[number];

export const CARDIO_DISTANCE_TRACKING_OPTIONS = ['none', 'total', 'per_duration_unit'] as const;
export type CardioDistanceTracking = (typeof CARDIO_DISTANCE_TRACKING_OPTIONS)[number];

export const DEFAULT_CARDIO_OBJECTIVE: CardioObjective = 'distance';
export const DEFAULT_CARDIO_DURATION_TRACKING: CardioDurationTracking = 'none';
export const DEFAULT_CARDIO_DISTANCE_TRACKING: CardioDistanceTracking = 'none';

export const CARDIO_OBJECTIVE_LABELS: Record<CardioObjective, string> = {
  distance: 'Distance',
  duration: 'Duration',
};

export const CARDIO_DURATION_TRACKING_LABELS: Record<CardioDurationTracking, string> = {
  none: "Don't Track Duration",
  total: 'Track Total Duration',
  per_distance_unit: 'Track Duration Per Distance Unit',
};

export const CARDIO_DISTANCE_TRACKING_LABELS: Record<CardioDistanceTracking, string> = {
  none: "Don't Track Distance",
  total: 'Track Total Distance',
  per_duration_unit: 'Track Distance Per Duration Unit',
};

/** @deprecated Legacy field — migrated to cardioObjective + tracking fields on load. */
export type LegacyCardioDistanceMode = 'per' | 'total';

export function isCardioObjective(value: string): value is CardioObjective {
  return (CARDIO_OBJECTIVES as readonly string[]).includes(value);
}

export function isCardioDurationTracking(value: string): value is CardioDurationTracking {
  return (CARDIO_DURATION_TRACKING_OPTIONS as readonly string[]).includes(value);
}

export function isCardioDistanceTracking(value: string): value is CardioDistanceTracking {
  return (CARDIO_DISTANCE_TRACKING_OPTIONS as readonly string[]).includes(value);
}

export function normalizeCardioObjective(value: unknown): CardioObjective {
  return typeof value === 'string' && isCardioObjective(value) ? value : DEFAULT_CARDIO_OBJECTIVE;
}

export function normalizeCardioDurationTracking(value: unknown): CardioDurationTracking {
  return typeof value === 'string' && isCardioDurationTracking(value) ? value : DEFAULT_CARDIO_DURATION_TRACKING;
}

export function normalizeCardioDistanceTracking(value: unknown): CardioDistanceTracking {
  return typeof value === 'string' && isCardioDistanceTracking(value) ? value : DEFAULT_CARDIO_DISTANCE_TRACKING;
}

export type CardioPlanFields = {
  cardioObjective: CardioObjective;
  cardioDurationTracking: CardioDurationTracking;
  cardioDistanceTracking: CardioDistanceTracking;
};

export function normalizeCardioPlanFields(
  exercise: Pick<
    WorkoutExercise,
    | 'activityType'
    | 'duration'
    | 'distance'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
  >,
): CardioPlanFields {
  if (exercise.activityType !== 'cardio') {
    return {
      cardioObjective: DEFAULT_CARDIO_OBJECTIVE,
      cardioDurationTracking: DEFAULT_CARDIO_DURATION_TRACKING,
      cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
    };
  }

  const hasNewObjective =
    typeof exercise.cardioObjective === 'string' && isCardioObjective(exercise.cardioObjective);

  if (hasNewObjective) {
    const objective = normalizeCardioObjective(exercise.cardioObjective);
    if (objective === 'distance') {
      return {
        cardioObjective: 'distance',
        cardioDurationTracking: normalizeCardioDurationTracking(exercise.cardioDurationTracking),
        cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
      };
    }
    return {
      cardioObjective: 'duration',
      cardioDurationTracking: DEFAULT_CARDIO_DURATION_TRACKING,
      cardioDistanceTracking: normalizeCardioDistanceTracking(exercise.cardioDistanceTracking),
    };
  }

  return migrateLegacyCardioDistanceMode(exercise);
}

function migrateLegacyCardioDistanceMode(
  exercise: Pick<WorkoutExercise, 'duration' | 'distance' | 'cardioDistanceMode'>,
): CardioPlanFields {
  const legacyMode = exercise.cardioDistanceMode;
  const hasDuration = exercise.duration > 0;
  const hasDistance = exercise.distance > 0;

  if (legacyMode === 'per') {
    return {
      cardioObjective: 'distance',
      cardioDurationTracking: 'per_distance_unit',
      cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
    };
  }

  if (hasDistance && !hasDuration) {
    return {
      cardioObjective: 'distance',
      cardioDurationTracking: 'none',
      cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
    };
  }

  if (hasDuration && !hasDistance) {
    return {
      cardioObjective: 'duration',
      cardioDurationTracking: DEFAULT_CARDIO_DURATION_TRACKING,
      cardioDistanceTracking: 'none',
    };
  }

  if (hasDuration && hasDistance) {
    return {
      cardioObjective: 'distance',
      cardioDurationTracking: 'total',
      cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
    };
  }

  return {
    cardioObjective: DEFAULT_CARDIO_OBJECTIVE,
    cardioDurationTracking: DEFAULT_CARDIO_DURATION_TRACKING,
    cardioDistanceTracking: DEFAULT_CARDIO_DISTANCE_TRACKING,
  };
}

export function isCardioDurationPerDistance(
  exercise: Pick<
    WorkoutExercise,
    'activityType' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceMode'
  > &
    Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>,
): boolean {
  const plan = normalizeCardioPlanFields({
    ...exercise,
    duration: exercise.duration ?? 0,
    distance: exercise.distance ?? 0,
  });
  return exercise.activityType === 'cardio' && plan.cardioObjective === 'distance' && plan.cardioDurationTracking === 'per_distance_unit';
}

export function isCardioDistancePerDuration(
  exercise: Pick<
    WorkoutExercise,
    'activityType' | 'cardioObjective' | 'cardioDistanceTracking' | 'cardioDistanceMode'
  > &
    Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>,
): boolean {
  const plan = normalizeCardioPlanFields({
    ...exercise,
    duration: exercise.duration ?? 0,
    distance: exercise.distance ?? 0,
  });
  return exercise.activityType === 'cardio' && plan.cardioObjective === 'duration' && plan.cardioDistanceTracking === 'per_duration_unit';
}

export function isCardioPerSegmentLogging(
  exercise: Pick<
    WorkoutExercise,
    'activityType' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode'
  > &
    Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>,
): boolean {
  return isCardioDurationPerDistance(exercise) || isCardioDistancePerDuration(exercise);
}

export type CardioLogLayout = 'objective_only' | 'total' | 'per_segment';

export function getCardioLogLayout(
  exercise: Pick<
    WorkoutExercise,
    'activityType' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode'
  > &
    Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>,
): CardioLogLayout {
  if (exercise.activityType !== 'cardio') {
    return 'objective_only';
  }
  if (isCardioPerSegmentLogging(exercise)) {
    return 'per_segment';
  }
  const plan = normalizeCardioPlanFields({
    ...exercise,
    activityType: 'cardio',
    duration: exercise.duration ?? 0,
    distance: exercise.distance ?? 0,
  });
  if (plan.cardioObjective === 'distance' && plan.cardioDurationTracking === 'total') {
    return 'total';
  }
  if (plan.cardioObjective === 'duration' && plan.cardioDistanceTracking === 'total') {
    return 'total';
  }
  return 'objective_only';
}

export function formatPlannedCardioSummary(
  exercise: Pick<
    WorkoutExercise,
    | 'duration'
    | 'durationUnit'
    | 'distance'
    | 'distanceUnit'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
  >,
): string {
  const plan = normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' });
  const durationLabel = formatDurationWithUnit(exercise.duration, exercise.durationUnit);
  const distanceLabel = formatCardioDistanceWithUnit(exercise.distance, exercise.distanceUnit);

  if (plan.cardioObjective === 'distance') {
    const parts: string[] = [];
    if (distanceLabel) {
      parts.push(distanceLabel);
    }
    if (plan.cardioDurationTracking === 'total' && durationLabel) {
      parts.push(durationLabel);
    }
    if (plan.cardioDurationTracking === 'per_distance_unit' && durationLabel) {
      const perUnit = formatCardioPerDistanceUnit(exercise.distanceUnit);
      parts.push(`${durationLabel} per ${perUnit}`);
    }
    return parts.length > 0 ? parts.join(', ') : 'No plan set';
  }

  const parts: string[] = [];
  if (durationLabel) {
    parts.push(durationLabel);
  }
  if (plan.cardioDistanceTracking === 'total' && distanceLabel) {
    parts.push(distanceLabel);
  }
  if (plan.cardioDistanceTracking === 'per_duration_unit' && distanceLabel) {
    const perUnit = DURATION_UNIT_ABBREVIATIONS[exercise.durationUnit];
    parts.push(`${distanceLabel} per ${perUnit}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'No plan set';
}

export function durationUnitAbbreviation(unit: DurationUnit): string {
  return DURATION_UNIT_ABBREVIATIONS[unit];
}

export function cardioPerDistanceUnitLabel(unit: CardioDistanceUnit): string {
  return formatCardioPerDistanceUnit(unit);
}

export function cardioPlansMatch(
  a: Pick<
    WorkoutExercise,
    | 'activityType'
    | 'duration'
    | 'distance'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
  >,
  b: Pick<
    WorkoutExercise,
    | 'activityType'
    | 'duration'
    | 'distance'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
  >,
): boolean {
  if (a.activityType !== 'cardio' || b.activityType !== 'cardio') {
    return true;
  }
  const planA = normalizeCardioPlanFields(a);
  const planB = normalizeCardioPlanFields(b);
  return (
    planA.cardioObjective === planB.cardioObjective &&
    planA.cardioDurationTracking === planB.cardioDurationTracking &&
    planA.cardioDistanceTracking === planB.cardioDistanceTracking
  );
}

export function hydrateCardioDraftFromStored(
  exercise: Pick<
    WorkoutExercise,
    | 'duration'
    | 'durationUnit'
    | 'distance'
    | 'distanceUnit'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
  >,
): CardioPlanFields & { duration: string; distance: string } {
  const plan = normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' });
  const durationUnit = normalizeDurationUnit(exercise.durationUnit);

  if (plan.cardioObjective === 'distance') {
    return {
      ...plan,
      distance:
        exercise.distance > 0 ? formatCardioDistanceValue(exercise.distance, exercise.distanceUnit) : '',
      duration:
        plan.cardioDurationTracking !== 'none' && exercise.duration > 0
          ? formatDurationValue(exercise.duration, durationUnit)
          : '',
    };
  }

  return {
    ...plan,
    duration:
      exercise.duration > 0 ? formatDurationValue(exercise.duration, durationUnit) : '',
    distance:
      plan.cardioDistanceTracking !== 'none' && exercise.distance > 0
        ? formatCardioDistanceValue(exercise.distance, exercise.distanceUnit)
        : '',
  };
}
