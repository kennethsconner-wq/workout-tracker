import {
  convertCardioDistance,
  formatCardioDistanceValue,
  formatCardioDistanceWithUnit,
  formatCardioPerDistanceUnit,
  normalizeCardioDistanceUnit,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  DURATION_UNIT_ABBREVIATIONS,
  formatDurationValue,
  formatDurationWithUnit,
  normalizeCardioDurationUnit,
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
  per_distance_unit: 'Track Pace',
};

export const CARDIO_DISTANCE_TRACKING_LABELS: Record<CardioDistanceTracking, string> = {
  none: "Don't Track Distance",
  total: 'Track Total Distance',
  per_duration_unit: 'Track Pace',
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

export function isCardioPaceTracking(
  exercise: Pick<
    WorkoutExercise,
    'activityType' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode'
  > &
    Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>,
): boolean {
  return isCardioDurationPerDistance(exercise) || isCardioDistancePerDuration(exercise);
}

type CardioChartPlanExercise = Pick<
  WorkoutExercise,
  'activityType' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode'
> &
  Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>;

/** Whether metrics should include a distance-by-session chart for this cardio plan. */
export function cardioExerciseShowsDistanceChart(exercise: CardioChartPlanExercise | null | undefined): boolean {
  if (!exercise || exercise.activityType !== 'cardio') {
    return false;
  }
  const plan = normalizeCardioPlanFields({
    ...exercise,
    activityType: 'cardio',
    duration: exercise.duration ?? 0,
    distance: exercise.distance ?? 0,
  });
  if (plan.cardioObjective === 'distance') {
    return true;
  }
  return plan.cardioDistanceTracking !== 'none';
}

/** Whether metrics should include a duration-by-session chart for this cardio plan. */
export function cardioExerciseShowsDurationChart(exercise: CardioChartPlanExercise | null | undefined): boolean {
  if (!exercise || exercise.activityType !== 'cardio') {
    return false;
  }
  const plan = normalizeCardioPlanFields({
    ...exercise,
    activityType: 'cardio',
    duration: exercise.duration ?? 0,
    distance: exercise.distance ?? 0,
  });
  if (plan.cardioObjective === 'duration') {
    return true;
  }
  return plan.cardioDurationTracking !== 'none';
}

/** Whether metrics should include an average-pace-by-session chart for this cardio plan. */
export function cardioExerciseShowsPaceChart(exercise: CardioChartPlanExercise | null | undefined): boolean {
  return exercise?.activityType === 'cardio' && isCardioPaceTracking(exercise);
}

export type CardioPacePlan = {
  duration: number;
  durationUnit: DurationUnit;
  distance: number;
  distanceUnit: CardioDistanceUnit;
};

function hasStoredCardioPaceFields(
  exercise: Pick<
    WorkoutExercise,
    'cardioPaceDuration' | 'cardioPaceDistance' | 'cardioPaceDurationUnit' | 'cardioPaceDistanceUnit'
  >,
): boolean {
  return (exercise.cardioPaceDuration ?? 0) > 0 && (exercise.cardioPaceDistance ?? 0) > 0;
}

/** Migrate legacy pace values stored in duration/distance fields into dedicated pace fields. */
export function migrateLegacyCardioPaceFields<
  T extends Pick<
    WorkoutExercise,
    | 'activityType'
    | 'duration'
    | 'durationUnit'
    | 'distance'
    | 'distanceUnit'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
    | 'cardioPaceDuration'
    | 'cardioPaceDurationUnit'
    | 'cardioPaceDistance'
    | 'cardioPaceDistanceUnit'
  >,
>(exercise: T): T {
  if (exercise.activityType !== 'cardio' || hasStoredCardioPaceFields(exercise)) {
    return exercise;
  }

  const plan = normalizeCardioPlanFields(exercise);

  if (plan.cardioObjective === 'distance' && plan.cardioDurationTracking === 'per_distance_unit') {
    if (exercise.duration <= 0) {
      return exercise;
    }
    return {
      ...exercise,
      cardioPaceDuration: exercise.duration,
      cardioPaceDurationUnit: normalizeCardioDurationUnit(exercise.durationUnit),
      cardioPaceDistance: 1,
      cardioPaceDistanceUnit: normalizeCardioDistanceUnit(exercise.distanceUnit),
      duration: 0,
    };
  }

  if (plan.cardioObjective === 'duration' && plan.cardioDistanceTracking === 'per_duration_unit') {
    if (exercise.distance <= 0) {
      return exercise;
    }
    return {
      ...exercise,
      cardioPaceDuration: exercise.distance,
      cardioPaceDurationUnit: normalizeCardioDurationUnit(exercise.durationUnit),
      cardioPaceDistance: 1,
      cardioPaceDistanceUnit: normalizeCardioDistanceUnit(exercise.distanceUnit),
      distance: 0,
    };
  }

  return exercise;
}

/** Planned pace is always duration per distance chunk. */
export function readCardioPacePlan(
  exercise: Pick<
    WorkoutExercise,
    | 'activityType'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
    | 'duration'
    | 'distance'
    | 'durationUnit'
    | 'distanceUnit'
    | 'cardioPaceDuration'
    | 'cardioPaceDurationUnit'
    | 'cardioPaceDistance'
    | 'cardioPaceDistanceUnit'
  >,
): CardioPacePlan | null {
  if (exercise.activityType !== 'cardio' || !isCardioPaceTracking(exercise)) {
    return null;
  }

  const migrated = migrateLegacyCardioPaceFields({ ...exercise, activityType: 'cardio' });

  if (hasStoredCardioPaceFields(migrated)) {
    return {
      duration: migrated.cardioPaceDuration ?? 0,
      durationUnit: normalizeCardioDurationUnit(migrated.cardioPaceDurationUnit ?? migrated.durationUnit),
      distance: migrated.cardioPaceDistance ?? 0,
      distanceUnit: normalizeCardioDistanceUnit(migrated.cardioPaceDistanceUnit ?? migrated.distanceUnit),
    };
  }

  return null;
}

/** @deprecated Use readCardioPacePlan — kept for call sites expecting the old shape. */
export function plannedCardioPaceDurationPerDistance(
  exercise: Pick<
    WorkoutExercise,
    | 'activityType'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
    | 'duration'
    | 'distance'
    | 'durationUnit'
    | 'distanceUnit'
    | 'cardioPaceDuration'
    | 'cardioPaceDurationUnit'
    | 'cardioPaceDistance'
    | 'cardioPaceDistanceUnit'
  >,
): { duration: number; durationUnit: DurationUnit; distanceUnit: CardioDistanceUnit; distance: number } | null {
  const pace = readCardioPacePlan(exercise);
  if (!pace) {
    return null;
  }
  return pace;
}

export function formatCardioPaceSummary(pace: CardioPacePlan): string {
  const durationLabel = formatDurationWithUnit(pace.duration, pace.durationUnit);
  const distanceLabel = formatCardioDistanceWithUnit(pace.distance, pace.distanceUnit);
  if (!durationLabel || !distanceLabel) {
    return '';
  }
  return `${durationLabel} per ${distanceLabel}`;
}

export function plannedDurationForObjectiveDistanceChunk(
  pace: CardioPacePlan,
  objectiveDistanceAmount: number,
  objectiveDistanceUnit: CardioDistanceUnit,
): number | null {
  const converted = convertCardioDistance(objectiveDistanceAmount, objectiveDistanceUnit, pace.distanceUnit);
  if (converted === null) {
    if (objectiveDistanceUnit !== pace.distanceUnit) {
      return null;
    }
    return (objectiveDistanceAmount / pace.distance) * pace.duration;
  }
  return (converted / pace.distance) * pace.duration;
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
    | 'cardioPaceDuration'
    | 'cardioPaceDurationUnit'
    | 'cardioPaceDistance'
    | 'cardioPaceDistanceUnit'
  >,
): string {
  const plan = normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' });
  const durationLabel = formatDurationWithUnit(exercise.duration, exercise.durationUnit);
  const distanceLabel = formatCardioDistanceWithUnit(exercise.distance, exercise.distanceUnit);
  const pace = readCardioPacePlan({ ...exercise, activityType: 'cardio' });
  const paceLabel = pace ? formatCardioPaceSummary(pace) : '';

  if (plan.cardioObjective === 'distance') {
    const parts: string[] = [];
    if (distanceLabel) {
      parts.push(distanceLabel);
    }
    if (plan.cardioDurationTracking === 'total' && durationLabel) {
      parts.push(durationLabel);
    }
    if (plan.cardioDurationTracking === 'per_distance_unit' && paceLabel) {
      parts.push(paceLabel);
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
  if (plan.cardioDistanceTracking === 'per_duration_unit' && paceLabel) {
    parts.push(paceLabel);
  }
  return parts.length > 0 ? parts.join(', ') : 'No plan set';
}

export function formatPlannedCardioObjectiveOnlySummary(
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
    return parts.length > 0 ? parts.join(', ') : 'No plan set';
  }

  const parts: string[] = [];
  if (durationLabel) {
    parts.push(durationLabel);
  }
  if (plan.cardioDistanceTracking === 'total' && distanceLabel) {
    parts.push(distanceLabel);
  }
  return parts.length > 0 ? parts.join(', ') : 'No plan set';
}

export function formatPlannedCardioPaceLine(
  exercise: Pick<
    WorkoutExercise,
    | 'activityType'
    | 'duration'
    | 'durationUnit'
    | 'distance'
    | 'distanceUnit'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
    | 'cardioPaceDuration'
    | 'cardioPaceDurationUnit'
    | 'cardioPaceDistance'
    | 'cardioPaceDistanceUnit'
  >,
): string | null {
  if (!isCardioPaceTracking({ ...exercise, activityType: 'cardio' })) {
    return null;
  }
  const pace = readCardioPacePlan({ ...exercise, activityType: 'cardio' });
  if (!pace) {
    return null;
  }
  const label = formatCardioPaceSummary(pace);
  return label.length > 0 ? label : null;
}

export function plannedCardioPaceDurationUnit(
  exercise: Pick<
    WorkoutExercise,
    | 'activityType'
    | 'cardioObjective'
    | 'cardioDurationTracking'
    | 'cardioDistanceTracking'
    | 'cardioDistanceMode'
    | 'duration'
    | 'distance'
    | 'durationUnit'
    | 'distanceUnit'
    | 'cardioPaceDuration'
    | 'cardioPaceDurationUnit'
    | 'cardioPaceDistance'
    | 'cardioPaceDistanceUnit'
  >,
): DurationUnit | null {
  return readCardioPacePlan(exercise)?.durationUnit ?? null;
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
    | 'cardioPaceDuration'
    | 'cardioPaceDurationUnit'
    | 'cardioPaceDistance'
    | 'cardioPaceDistanceUnit'
  >,
): CardioPlanFields & {
  duration: string;
  distance: string;
  paceDuration: string;
  paceDurationUnit: DurationUnit;
  paceDistance: string;
  paceDistanceUnit: CardioDistanceUnit;
} {
  const migrated = migrateLegacyCardioPaceFields({ ...exercise, activityType: 'cardio' });
  const plan = normalizeCardioPlanFields({ ...migrated, activityType: 'cardio' });
  const durationUnit = normalizeCardioDurationUnit(migrated.durationUnit);
  const pace = readCardioPacePlan({ ...migrated, activityType: 'cardio' });
  const paceDurationUnit = normalizeCardioDurationUnit(
    migrated.cardioPaceDurationUnit ?? pace?.durationUnit ?? durationUnit,
  );
  const paceDistanceUnit = normalizeCardioDistanceUnit(
    migrated.cardioPaceDistanceUnit ?? pace?.distanceUnit ?? migrated.distanceUnit,
  );

  if (plan.cardioObjective === 'distance') {
    return {
      ...plan,
      distance:
        migrated.distance > 0 ? formatCardioDistanceValue(migrated.distance, migrated.distanceUnit) : '',
      duration:
        plan.cardioDurationTracking === 'total' && migrated.duration > 0
          ? formatDurationValue(migrated.duration, durationUnit)
          : '',
      paceDuration:
        pace && pace.duration > 0 ? formatDurationValue(pace.duration, pace.durationUnit) : '',
      paceDurationUnit,
      paceDistance:
        pace && pace.distance > 0 ? formatCardioDistanceValue(pace.distance, pace.distanceUnit) : '',
      paceDistanceUnit,
    };
  }

  return {
    ...plan,
    duration:
      migrated.duration > 0 ? formatDurationValue(migrated.duration, durationUnit) : '',
    distance:
      plan.cardioDistanceTracking === 'total' && migrated.distance > 0
        ? formatCardioDistanceValue(migrated.distance, migrated.distanceUnit)
        : '',
    paceDuration:
      pace && pace.duration > 0 ? formatDurationValue(pace.duration, pace.durationUnit) : '',
    paceDurationUnit,
    paceDistance:
      pace && pace.distance > 0 ? formatCardioDistanceValue(pace.distance, pace.distanceUnit) : '',
    paceDistanceUnit,
  };
}
