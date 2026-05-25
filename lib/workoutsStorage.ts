import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeActivityType } from '@/lib/activityTypes';
import { sanitizeWorkoutExercise } from '@/lib/exerciseDraft';
import { readActualStretchSetsFromStored, readStretchSetsFromStored } from '@/lib/stretchSets';
import { cardioPlansMatch, normalizeCardioDistanceTracking, normalizeCardioDurationTracking, normalizeCardioObjective } from '@/lib/cardioPlan';
import { DEFAULT_CARDIO_DISTANCE_UNIT, migrateLegacyCardioSetsDurationToDistance, normalizeCardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import { readActualCardioPerSetsFromStored } from '@/lib/cardioPerLog';
import { DEFAULT_DURATION_UNIT, normalizeDurationUnit } from '@/lib/durationUnits';
import { DEFAULT_SCORE_UNIT, normalizeScoreUnit } from '@/lib/scoreUnits';
import { DEFAULT_WEIGHT_UNIT, normalizeWeightUnit } from '@/lib/weightUnits';
import { newId } from '@/lib/ids';
import { normalizeWorkoutIconId } from '@/lib/workoutIcons';
import {
  DAYS_OF_WEEK,
  type DayOfWeek,
  type LoggedWorkout,
  type Workout,
  type WorkoutExercise,
} from '@/lib/types';

function isDayOfWeek(value: string): value is DayOfWeek {
  return (DAYS_OF_WEEK as readonly string[]).includes(value);
}

const LEGACY_TITLE_DAY_RE = new RegExp(`^(.+?)\\s+\\((${DAYS_OF_WEEK.join('|')})\\)$`);

function readExerciseDistance(exercise: Record<string, unknown>): number {
  if (typeof exercise.distance === 'number') {
    return exercise.distance;
  }
  if (typeof exercise.distanceMiles === 'number') {
    return exercise.distanceMiles;
  }
  return 0;
}

function readExerciseDistanceUnit(exercise: Record<string, unknown>): ReturnType<typeof normalizeCardioDistanceUnit> {
  if (typeof exercise.distanceUnit === 'string') {
    return normalizeCardioDistanceUnit(exercise.distanceUnit);
  }
  return DEFAULT_CARDIO_DISTANCE_UNIT;
}

function readExerciseDuration(exercise: Record<string, unknown>): number {
  if (typeof exercise.duration === 'number') {
    return exercise.duration;
  }
  if (typeof exercise.durationMinutes === 'number') {
    return exercise.durationMinutes;
  }
  return 0;
}

function readExerciseDurationUnit(exercise: Record<string, unknown>): ReturnType<typeof normalizeDurationUnit> {
  if (typeof exercise.durationUnit === 'string') {
    return normalizeDurationUnit(exercise.durationUnit);
  }
  return DEFAULT_DURATION_UNIT;
}

function readExerciseScoreUnit(exercise: Record<string, unknown>): ReturnType<typeof normalizeScoreUnit> {
  if (typeof exercise.scoreUnit === 'string') {
    return normalizeScoreUnit(exercise.scoreUnit);
  }
  return DEFAULT_SCORE_UNIT;
}

function readExerciseWeight(exercise: Record<string, unknown>): number {
  if (typeof exercise.weight === 'number') {
    return exercise.weight;
  }
  if (typeof exercise.weightKg === 'number') {
    return exercise.weightKg;
  }
  return 0;
}

function readExerciseWeightUnit(exercise: Record<string, unknown>): ReturnType<typeof normalizeWeightUnit> {
  if (typeof exercise.weightUnit === 'string') {
    return normalizeWeightUnit(exercise.weightUnit);
  }
  return DEFAULT_WEIGHT_UNIT;
}

function normalizeWorkoutExercise(raw: unknown): WorkoutExercise {
  const exercise = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const activityType = normalizeActivityType(exercise.activityType);
  const rawDurationUnit = typeof exercise.durationUnit === 'string' ? exercise.durationUnit : undefined;
  const migrated = migrateLegacyCardioSetsDurationToDistance({
    activityType,
    duration: readExerciseDuration(exercise),
    durationUnit: rawDurationUnit ?? readExerciseDurationUnit(exercise),
    distance: readExerciseDistance(exercise),
    distanceUnit: readExerciseDistanceUnit(exercise),
  });
  return sanitizeWorkoutExercise({
    id: typeof exercise.id === 'string' ? exercise.id : newId(),
    activityType,
    name: typeof exercise.name === 'string' ? exercise.name : '',
    sets: typeof exercise.sets === 'number' ? exercise.sets : 0,
    reps: typeof exercise.reps === 'number' ? exercise.reps : 0,
    weight: readExerciseWeight(exercise),
    weightUnit: readExerciseWeightUnit(exercise),
    duration: migrated.duration,
    durationUnit: normalizeDurationUnit(migrated.durationUnit),
    distance: migrated.distance,
    distanceUnit: normalizeCardioDistanceUnit(migrated.distanceUnit),
    cardioObjective: activityType === 'cardio' ? normalizeCardioObjective(exercise.cardioObjective) : undefined,
    cardioDurationTracking:
      activityType === 'cardio' ? normalizeCardioDurationTracking(exercise.cardioDurationTracking) : undefined,
    cardioDistanceTracking:
      activityType === 'cardio' ? normalizeCardioDistanceTracking(exercise.cardioDistanceTracking) : undefined,
    cardioDistanceMode:
      activityType === 'cardio' &&
      (exercise.cardioDistanceMode === 'per' || exercise.cardioDistanceMode === 'total')
        ? exercise.cardioDistanceMode
        : undefined,
    score: typeof exercise.score === 'string' ? exercise.score : '',
    scoreUnit: readExerciseScoreUnit(exercise),
    stretchSets: readStretchSetsFromStored(exercise, activityType),
  });
}

function normalizeWorkoutExercises(raw: unknown): WorkoutExercise[] {
  return Array.isArray(raw) ? raw.map((exercise) => normalizeWorkoutExercise(exercise)) : [];
}

function normalizeStoredWorkout(raw: Workout & { dayOfWeek?: string; iconId?: unknown; daysOfWeek?: unknown }): Workout {
  const { id, createdAt, exercises: rawExercises } = raw;
  const exercises = normalizeWorkoutExercises(rawExercises);
  let title = raw.title;
  const daysFromArray = Array.isArray(raw.daysOfWeek)
    ? raw.daysOfWeek.filter((day): day is DayOfWeek => typeof day === 'string' && isDayOfWeek(day))
    : [];
  let day = raw.dayOfWeek;
  const iconId = normalizeWorkoutIconId(raw.iconId);

  if (daysFromArray.length > 0) {
    return { id, createdAt, title, daysOfWeek: Array.from(new Set(daysFromArray)), iconId, exercises };
  }

  if (day && isDayOfWeek(day)) {
    const legacy = title.match(LEGACY_TITLE_DAY_RE);
    if (legacy && legacy[2] === day) {
      title = legacy[1].trim();
    }
    return { id, createdAt, title, daysOfWeek: [day], iconId, exercises };
  }

  const m = title.match(LEGACY_TITLE_DAY_RE);
  if (m && isDayOfWeek(m[2])) {
    return { id, createdAt, title: m[1].trim(), daysOfWeek: [m[2]], iconId, exercises };
  }

  return { id, createdAt, title, daysOfWeek: ['Monday'], iconId, exercises };
}

const LOGGED_WORKOUTS_STORAGE_KEY = 'workouts@v1';
const WORKOUTS_STORAGE_KEY = 'workout-templates@v1';

function normalizeStoredLoggedWorkout(raw: LoggedWorkout & { workoutId?: unknown; daysOfWeek?: unknown; iconId?: unknown }): LoggedWorkout {
  const normalizedExercises = Array.isArray(raw.exercises)
    ? raw.exercises.map((exercise) => {
        const rawLegacyPlannedSets = (exercise as unknown as { sets?: unknown }).sets;
        const plannedSetsFromLegacyArray = Array.isArray(rawLegacyPlannedSets)
          ? (rawLegacyPlannedSets as Array<{ reps?: unknown; weightKg?: unknown }>)
          : [];
        const legacyPlannedSetCount = plannedSetsFromLegacyArray.length;
        const legacyPlannedReps =
          legacyPlannedSetCount > 0 && typeof plannedSetsFromLegacyArray[0]?.reps === 'number'
            ? plannedSetsFromLegacyArray[0].reps
            : 0;
        const legacyPlannedWeight =
          legacyPlannedSetCount > 0 && typeof plannedSetsFromLegacyArray[0]?.weightKg === 'number'
            ? plannedSetsFromLegacyArray[0].weightKg
            : 0;
        const legacyActualReps =
          typeof (exercise as unknown as { actualReps?: unknown }).actualReps === 'number'
            ? (exercise as unknown as { actualReps: number }).actualReps
            : legacyPlannedReps;
        const legacyActualWeight =
          typeof (exercise as unknown as { actualWeight?: unknown }).actualWeight === 'number'
            ? (exercise as unknown as { actualWeight: number }).actualWeight
            : typeof (exercise as unknown as { actualWeightKg?: unknown }).actualWeightKg === 'number'
              ? (exercise as unknown as { actualWeightKg: number }).actualWeightKg
              : legacyPlannedWeight;
        const legacyActualWeightUnit = readExerciseWeightUnit(exercise as Record<string, unknown>);
        const legacyActualSetCount =
          typeof (exercise as unknown as { actualSets?: unknown }).actualSets === 'number'
            ? Math.max(0, Math.floor((exercise as unknown as { actualSets: number }).actualSets))
            : legacyPlannedSetCount;
        const actualSetsFromNewShape = Array.isArray((exercise as { actualSets?: unknown }).actualSets)
          ? ((exercise as { actualSets: Array<{ actualReps?: unknown; actualWeight?: unknown; actualWeightKg?: unknown }> }).actualSets ?? [])
              .map((actualSet) => ({
                actualReps: typeof actualSet.actualReps === 'number' ? actualSet.actualReps : legacyActualReps,
                actualWeight:
                  typeof actualSet.actualWeight === 'number'
                    ? actualSet.actualWeight
                    : typeof actualSet.actualWeightKg === 'number'
                      ? actualSet.actualWeightKg
                      : legacyActualWeight,
              }))
          : null;
        const normalizedActualSets =
          actualSetsFromNewShape ??
          Array.from({ length: legacyActualSetCount }, () => ({
            actualReps: legacyActualReps,
            actualWeight: legacyActualWeight,
          }));

        const activityType = normalizeActivityType((exercise as { activityType?: unknown }).activityType);
        const rawDurationUnit =
          typeof (exercise as { durationUnit?: unknown }).durationUnit === 'string'
            ? (exercise as { durationUnit: string }).durationUnit
            : undefined;
        const migratedPlan = migrateLegacyCardioSetsDurationToDistance({
          activityType,
          duration: readExerciseDuration(exercise as Record<string, unknown>),
          durationUnit: rawDurationUnit ?? readExerciseDurationUnit(exercise as Record<string, unknown>),
          distance: readExerciseDistance(exercise as Record<string, unknown>),
          distanceUnit: readExerciseDistanceUnit(exercise as Record<string, unknown>),
        });
        const rawActualDurationUnit =
          typeof (exercise as { actualDurationUnit?: unknown }).actualDurationUnit === 'string'
            ? (exercise as { actualDurationUnit: string }).actualDurationUnit
            : undefined;
        const actualDurationRaw =
          typeof (exercise as { actualDuration?: unknown }).actualDuration === 'number'
            ? (exercise as { actualDuration: number }).actualDuration
            : typeof (exercise as unknown as { actualDurationMinutes?: unknown }).actualDurationMinutes === 'number'
              ? (exercise as unknown as { actualDurationMinutes: number }).actualDurationMinutes
              : 0;
        const actualDistanceRaw =
          typeof (exercise as { actualDistance?: unknown }).actualDistance === 'number'
            ? (exercise as { actualDistance: number }).actualDistance
            : typeof (exercise as unknown as { actualDistanceMiles?: unknown }).actualDistanceMiles === 'number'
              ? (exercise as unknown as { actualDistanceMiles: number }).actualDistanceMiles
              : 0;
        const migratedActual = migrateLegacyCardioSetsDurationToDistance({
          activityType,
          duration: actualDurationRaw,
          durationUnit: rawActualDurationUnit ?? readExerciseDurationUnit(exercise as Record<string, unknown>),
          distance: actualDistanceRaw,
          distanceUnit: readExerciseDistanceUnit(exercise as Record<string, unknown>),
        });

        return {
          id: typeof exercise.id === 'string' ? exercise.id : newId(),
          workoutExerciseId:
            typeof (exercise as { workoutExerciseId?: unknown }).workoutExerciseId === 'string'
              ? ((exercise as { workoutExerciseId: string }).workoutExerciseId ?? '')
              : typeof exercise.id === 'string'
                ? exercise.id
                : newId(),
          activityType,
          name: typeof exercise.name === 'string' ? exercise.name : '',
          sets:
            typeof (exercise as { sets?: unknown }).sets === 'number'
              ? (exercise as { sets: number }).sets
              : legacyPlannedSetCount,
          reps: typeof (exercise as { reps?: unknown }).reps === 'number' ? (exercise as { reps: number }).reps : legacyPlannedReps,
          weight: readExerciseWeight(exercise as Record<string, unknown>),
          weightUnit: readExerciseWeightUnit(exercise as Record<string, unknown>),
          duration: migratedPlan.duration,
          durationUnit: normalizeDurationUnit(migratedPlan.durationUnit),
          distance: migratedPlan.distance,
          distanceUnit: normalizeCardioDistanceUnit(migratedPlan.distanceUnit),
          cardioObjective:
            activityType === 'cardio'
              ? normalizeCardioObjective((exercise as { cardioObjective?: unknown }).cardioObjective)
              : undefined,
          cardioDurationTracking:
            activityType === 'cardio'
              ? normalizeCardioDurationTracking((exercise as { cardioDurationTracking?: unknown }).cardioDurationTracking)
              : undefined,
          cardioDistanceTracking:
            activityType === 'cardio'
              ? normalizeCardioDistanceTracking((exercise as { cardioDistanceTracking?: unknown }).cardioDistanceTracking)
              : undefined,
          cardioDistanceMode:
            activityType === 'cardio' &&
            ((exercise as { cardioDistanceMode?: unknown }).cardioDistanceMode === 'per' ||
              (exercise as { cardioDistanceMode?: unknown }).cardioDistanceMode === 'total')
              ? ((exercise as { cardioDistanceMode: 'per' | 'total' }).cardioDistanceMode)
              : undefined,
          score: typeof (exercise as { score?: unknown }).score === 'string' ? (exercise as { score: string }).score : '',
          scoreUnit: readExerciseScoreUnit(exercise as Record<string, unknown>),
          actualSets: normalizedActualSets,
          actualWeightUnit:
            typeof (exercise as { actualWeightUnit?: unknown }).actualWeightUnit === 'string'
              ? normalizeWeightUnit((exercise as { actualWeightUnit: string }).actualWeightUnit)
              : legacyActualWeightUnit,
          actualDuration: migratedActual.duration,
          actualDurationUnit: normalizeDurationUnit(migratedActual.durationUnit),
          actualDistance: migratedActual.distance,
          actualDistanceUnit: normalizeCardioDistanceUnit(migratedActual.distanceUnit),
          actualScore:
            typeof (exercise as { actualScore?: unknown }).actualScore === 'string'
              ? (exercise as { actualScore: string }).actualScore
              : '',
          actualScoreUnit:
            typeof (exercise as { actualScoreUnit?: unknown }).actualScoreUnit === 'string'
              ? normalizeScoreUnit((exercise as { actualScoreUnit: string }).actualScoreUnit)
              : readExerciseScoreUnit(exercise as Record<string, unknown>),
          actualStretchSets: readActualStretchSetsFromStored(exercise as Record<string, unknown>),
          actualCardioPerSets: readActualCardioPerSetsFromStored(exercise as Record<string, unknown>),
          stretchSets: readStretchSetsFromStored(exercise as Record<string, unknown>, activityType),
        };
      })
    : [];

  const normalizedDays = Array.isArray(raw.daysOfWeek)
    ? raw.daysOfWeek.filter((day): day is DayOfWeek => typeof day === 'string' && isDayOfWeek(day))
    : [];

  return {
    id: raw.id,
    workoutId: typeof raw.workoutId === 'string' ? raw.workoutId : raw.id,
    createdAt: raw.createdAt,
    title: raw.title,
    daysOfWeek: normalizedDays.length > 0 ? Array.from(new Set(normalizedDays)) : ['Monday'],
    iconId: normalizeWorkoutIconId(raw.iconId),
    exercises: normalizedExercises,
  };
}

export async function loadLoggedWorkouts(): Promise<LoggedWorkout[]> {
  const raw = await AsyncStorage.getItem(LOGGED_WORKOUTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as LoggedWorkout[];
    return Array.isArray(parsed) ? parsed.map((w) => normalizeStoredLoggedWorkout(w)) : [];
  } catch {
    return [];
  }
}

async function saveLoggedWorkouts(workouts: LoggedWorkout[]): Promise<void> {
  await AsyncStorage.setItem(LOGGED_WORKOUTS_STORAGE_KEY, JSON.stringify(workouts));
}

export async function addLoggedWorkout(
  workout: Omit<LoggedWorkout, 'id' | 'createdAt'> & Partial<Pick<LoggedWorkout, 'id' | 'createdAt'>>,
): Promise<LoggedWorkout> {
  const existing = await loadLoggedWorkouts();
  const next: LoggedWorkout = {
    id: workout.id ?? newId(),
    workoutId: workout.workoutId,
    createdAt: workout.createdAt ?? new Date().toISOString(),
    title: workout.title,
    daysOfWeek: Array.from(new Set(workout.daysOfWeek)),
    iconId: normalizeWorkoutIconId(workout.iconId),
    exercises: workout.exercises,
  };
  await saveLoggedWorkouts([next, ...existing]);
  return next;
}

export async function deleteLoggedWorkout(id: string): Promise<void> {
  const existing = await loadLoggedWorkouts();
  await saveLoggedWorkouts(existing.filter((w) => w.id !== id));
}

export async function updateLoggedWorkout(
  id: string,
  patch: Pick<LoggedWorkout, 'title' | 'daysOfWeek' | 'iconId' | 'exercises' | 'workoutId'> &
    Partial<Pick<LoggedWorkout, 'createdAt'>>,
): Promise<LoggedWorkout | null> {
  const existing = await loadLoggedWorkouts();
  const prev = existing.find((w) => w.id === id);
  if (!prev) {
    return null;
  }
  const nextEntry: LoggedWorkout = {
    ...prev,
    workoutId: patch.workoutId,
    title: patch.title,
    daysOfWeek: Array.from(new Set(patch.daysOfWeek)),
    iconId: normalizeWorkoutIconId(patch.iconId),
    exercises: patch.exercises,
    ...(patch.createdAt !== undefined ? { createdAt: patch.createdAt } : {}),
  };
  await saveLoggedWorkouts(existing.map((w) => (w.id === id ? nextEntry : w)));
  return nextEntry;
}

export async function deleteLoggedWorkoutsByWorkoutId(workoutId: string): Promise<void> {
  const existing = await loadLoggedWorkouts();
  await saveLoggedWorkouts(existing.filter((w) => w.workoutId !== workoutId));
}

/** First template exercise with this id across saved workouts (ids are unique per exercise). */
export function findTemplateExerciseById(workouts: Workout[], exerciseId: string): WorkoutExercise | undefined {
  for (const w of workouts) {
    const found = w.exercises.find((e) => e.id === exerciseId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

export async function loadWorkouts(): Promise<Workout[]> {
  const raw = await AsyncStorage.getItem(WORKOUTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Workout[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((w) => normalizeStoredWorkout(w));
  } catch {
    return [];
  }
}

async function saveWorkouts(workouts: Workout[]): Promise<void> {
  await AsyncStorage.setItem(WORKOUTS_STORAGE_KEY, JSON.stringify(workouts));
}

export async function addWorkout(
  workout: Omit<Workout, 'id' | 'createdAt'> & Partial<Pick<Workout, 'id' | 'createdAt'>>,
): Promise<Workout> {
  const existing = await loadWorkouts();
  const next: Workout = {
    id: workout.id ?? newId(),
    createdAt: workout.createdAt ?? new Date().toISOString(),
    title: workout.title,
    daysOfWeek: Array.from(new Set(workout.daysOfWeek)),
    iconId: normalizeWorkoutIconId(workout.iconId),
    exercises: workout.exercises,
  };
  await saveWorkouts([next, ...existing]);
  return next;
}

export async function deleteWorkout(id: string): Promise<void> {
  const existing = await loadWorkouts();
  await saveWorkouts(existing.filter((w) => w.id !== id));
}

export async function updateWorkout(
  id: string,
  updates: Omit<Workout, 'id' | 'createdAt'>,
): Promise<Workout | null> {
  const existing = await loadWorkouts();
  const target = existing.find((w) => w.id === id);
  if (!target) {
    return null;
  }

  const nextWorkout: Workout = {
    ...target,
    title: updates.title,
    daysOfWeek: Array.from(new Set(updates.daysOfWeek)),
    iconId: normalizeWorkoutIconId(updates.iconId),
    exercises: updates.exercises,
  };
  const next = existing.map((w) => (w.id === id ? nextWorkout : w));
  await saveWorkouts(next);
  return nextWorkout;
}

/** For each exercise id, apply name/activityType/sets/reps/weight/duration/distance/score to every workout that contains that exercise id (linked / library exercises). */
export async function propagateExerciseDefinitionsAcrossWorkouts(
  exercises: Array<
    Pick<
      WorkoutExercise,
      'id' | 'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
    >
  >,
): Promise<void> {
  if (exercises.length === 0) {
    return;
  }
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const all = await loadWorkouts();
  const next = all.map((workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) => {
      const definition = byId.get(exercise.id);
      if (!definition) {
        return exercise;
      }
      return sanitizeWorkoutExercise({
        ...exercise,
        activityType: definition.activityType,
        name: definition.name,
        sets: definition.sets,
        reps: definition.reps,
        weight: definition.weight,
        weightUnit: definition.weightUnit,
        duration: definition.duration,
        durationUnit: definition.durationUnit,
        distance: definition.distance,
        distanceUnit: definition.distanceUnit,
        cardioObjective: definition.cardioObjective,
        cardioDurationTracking: definition.cardioDurationTracking,
        cardioDistanceTracking: definition.cardioDistanceTracking,
        score: definition.score,
        scoreUnit: definition.scoreUnit,
      });
    }),
  }));
  await saveWorkouts(next);
}

function matchesExerciseDefinition(
  ex: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
  >,
  def: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
  >,
): boolean {
  return (
    ex.activityType === def.activityType &&
    ex.name === def.name &&
    ex.sets === def.sets &&
    ex.reps === def.reps &&
    ex.weight === def.weight &&
    ex.weightUnit === def.weightUnit &&
    ex.duration === def.duration &&
    ex.durationUnit === def.durationUnit &&
    ex.distance === def.distance &&
    ex.distanceUnit === def.distanceUnit &&
    cardioPlansMatch(ex, def) &&
    ex.score === def.score &&
    ex.scoreUnit === def.scoreUnit
  );
}

/**
 * Updates every template exercise whose definition matches `oldDef` to `nextDef` (preserving each exercise `id`),
 * then updates matching planned fields on logged exercises with the same `workoutExerciseId`.
 */
export async function updateExercisesMatchingSignatureAcrossWorkouts(
  oldDef: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
  >,
  nextDef: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
  >,
): Promise<void> {
  const all = await loadWorkouts();
  const updates: Array<
    Pick<
      WorkoutExercise,
      'id' | 'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
    >
  > = [];
  const affectedIds = new Set<string>();
  for (const w of all) {
    for (const ex of w.exercises) {
      if (matchesExerciseDefinition(ex, oldDef)) {
        updates.push({ id: ex.id, ...nextDef });
        affectedIds.add(ex.id);
      }
    }
  }
  await propagateExerciseDefinitionsAcrossWorkouts(updates);
  if (affectedIds.size === 0) {
    return;
  }
  const cleanNext = sanitizeWorkoutExercise({
    id: 'sanitize',
    activityType: nextDef.activityType,
    name: nextDef.name,
    sets: nextDef.sets,
    reps: nextDef.reps,
    weight: nextDef.weight,
    weightUnit: nextDef.weightUnit,
    duration: nextDef.duration,
    durationUnit: nextDef.durationUnit,
    distance: nextDef.distance,
    distanceUnit: nextDef.distanceUnit,
    cardioObjective: nextDef.cardioObjective,
    cardioDurationTracking: nextDef.cardioDurationTracking,
    cardioDistanceTracking: nextDef.cardioDistanceTracking,
    score: nextDef.score,
    scoreUnit: nextDef.scoreUnit,
  });
  const logs = await loadLoggedWorkouts();
  const nextLogs = logs.map((log) => ({
    ...log,
    exercises: log.exercises.map((lex) =>
      affectedIds.has(lex.workoutExerciseId)
        ? {
            ...lex,
            activityType: cleanNext.activityType,
            name: cleanNext.name,
            sets: cleanNext.sets,
            reps: cleanNext.reps,
            weight: cleanNext.weight,
            weightUnit: cleanNext.weightUnit,
            duration: cleanNext.duration,
            durationUnit: cleanNext.durationUnit,
            distance: cleanNext.distance,
            distanceUnit: cleanNext.distanceUnit,
            cardioObjective: cleanNext.cardioObjective,
            cardioDurationTracking: cleanNext.cardioDurationTracking,
            cardioDistanceTracking: cleanNext.cardioDistanceTracking,
            score: cleanNext.score,
            scoreUnit: cleanNext.scoreUnit,
          }
        : lex,
    ),
  }));
  await saveLoggedWorkouts(nextLogs);
}

/** Removes matching exercises from all workout templates and from logged workouts; drops empty logs. */
export async function removeExercisesMatchingSignatureFromAllWorkouts(
  def: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
  >,
): Promise<void> {
  const all = await loadWorkouts();
  const idsToRemove = new Set<string>();
  for (const w of all) {
    for (const ex of w.exercises) {
      if (matchesExerciseDefinition(ex, def)) {
        idsToRemove.add(ex.id);
      }
    }
  }
  const nextTemplates = all.map((w) => ({
    ...w,
    exercises: w.exercises.filter((ex) => !matchesExerciseDefinition(ex, def)),
  }));
  if (idsToRemove.size === 0) {
    return;
  }
  await saveWorkouts(nextTemplates);

  const logs = await loadLoggedWorkouts();
  const nextLogs = logs
    .map((log) => ({
      ...log,
      exercises: log.exercises.filter((lex) => !idsToRemove.has(lex.workoutExerciseId)),
    }))
    .filter((log) => log.exercises.length > 0);
  await saveLoggedWorkouts(nextLogs);
}
