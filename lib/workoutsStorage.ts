import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeActivityType } from '@/lib/activityTypes';
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

function normalizeWorkoutExercise(raw: unknown): WorkoutExercise {
  const exercise = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: typeof exercise.id === 'string' ? exercise.id : newId(),
    activityType: normalizeActivityType(exercise.activityType),
    name: typeof exercise.name === 'string' ? exercise.name : '',
    sets: typeof exercise.sets === 'number' ? exercise.sets : 0,
    reps: typeof exercise.reps === 'number' ? exercise.reps : 0,
    weightKg: typeof exercise.weightKg === 'number' ? exercise.weightKg : 0,
    durationMinutes: typeof exercise.durationMinutes === 'number' ? exercise.durationMinutes : 0,
    distanceMiles: typeof exercise.distanceMiles === 'number' ? exercise.distanceMiles : 0,
    score: typeof exercise.score === 'string' ? exercise.score : '',
  };
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
        const legacyActualWeightKg =
          typeof (exercise as unknown as { actualWeightKg?: unknown }).actualWeightKg === 'number'
            ? (exercise as unknown as { actualWeightKg: number }).actualWeightKg
            : legacyPlannedWeight;
        const legacyActualSetCount =
          typeof (exercise as unknown as { actualSets?: unknown }).actualSets === 'number'
            ? Math.max(0, Math.floor((exercise as unknown as { actualSets: number }).actualSets))
            : legacyPlannedSetCount;
        const actualSetsFromNewShape = Array.isArray((exercise as { actualSets?: unknown }).actualSets)
          ? ((exercise as { actualSets: Array<{ actualReps?: unknown; actualWeightKg?: unknown }> }).actualSets ?? [])
              .map((actualSet) => ({
                actualReps: typeof actualSet.actualReps === 'number' ? actualSet.actualReps : legacyActualReps,
                actualWeightKg: typeof actualSet.actualWeightKg === 'number' ? actualSet.actualWeightKg : legacyActualWeightKg,
              }))
          : null;
        const normalizedActualSets =
          actualSetsFromNewShape ??
          Array.from({ length: legacyActualSetCount }, () => ({
            actualReps: legacyActualReps,
            actualWeightKg: legacyActualWeightKg,
          }));

        return {
          id: typeof exercise.id === 'string' ? exercise.id : newId(),
          workoutExerciseId:
            typeof (exercise as { workoutExerciseId?: unknown }).workoutExerciseId === 'string'
              ? ((exercise as { workoutExerciseId: string }).workoutExerciseId ?? '')
              : typeof exercise.id === 'string'
                ? exercise.id
                : newId(),
          activityType: normalizeActivityType((exercise as { activityType?: unknown }).activityType),
          name: typeof exercise.name === 'string' ? exercise.name : '',
          sets:
            typeof (exercise as { sets?: unknown }).sets === 'number'
              ? (exercise as { sets: number }).sets
              : legacyPlannedSetCount,
          reps: typeof (exercise as { reps?: unknown }).reps === 'number' ? (exercise as { reps: number }).reps : legacyPlannedReps,
          weightKg:
            typeof (exercise as { weightKg?: unknown }).weightKg === 'number'
              ? (exercise as { weightKg: number }).weightKg
              : legacyPlannedWeight,
          durationMinutes:
            typeof (exercise as { durationMinutes?: unknown }).durationMinutes === 'number'
              ? (exercise as { durationMinutes: number }).durationMinutes
              : 0,
          distanceMiles:
            typeof (exercise as { distanceMiles?: unknown }).distanceMiles === 'number'
              ? (exercise as { distanceMiles: number }).distanceMiles
              : 0,
          score: typeof (exercise as { score?: unknown }).score === 'string' ? (exercise as { score: string }).score : '',
          actualSets: normalizedActualSets,
          actualDurationMinutes:
            typeof (exercise as { actualDurationMinutes?: unknown }).actualDurationMinutes === 'number'
              ? (exercise as { actualDurationMinutes: number }).actualDurationMinutes
              : 0,
          actualDistanceMiles:
            typeof (exercise as { actualDistanceMiles?: unknown }).actualDistanceMiles === 'number'
              ? (exercise as { actualDistanceMiles: number }).actualDistanceMiles
              : 0,
          actualScore:
            typeof (exercise as { actualScore?: unknown }).actualScore === 'string'
              ? (exercise as { actualScore: string }).actualScore
              : '',
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
      'id' | 'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
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
      return {
        ...exercise,
        activityType: definition.activityType,
        name: definition.name,
        sets: definition.sets,
        reps: definition.reps,
        weightKg: definition.weightKg,
        durationMinutes: definition.durationMinutes,
        distanceMiles: definition.distanceMiles,
        score: definition.score,
      };
    }),
  }));
  await saveWorkouts(next);
}

function matchesExerciseDefinition(
  ex: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
  >,
  def: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
  >,
): boolean {
  return (
    ex.activityType === def.activityType &&
    ex.name === def.name &&
    ex.sets === def.sets &&
    ex.reps === def.reps &&
    ex.weightKg === def.weightKg &&
    ex.durationMinutes === def.durationMinutes &&
    ex.distanceMiles === def.distanceMiles &&
    ex.score === def.score
  );
}

/**
 * Updates every template exercise whose definition matches `oldDef` to `nextDef` (preserving each exercise `id`),
 * then updates matching planned fields on logged exercises with the same `workoutExerciseId`.
 */
export async function updateExercisesMatchingSignatureAcrossWorkouts(
  oldDef: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
  >,
  nextDef: Pick<
    WorkoutExercise,
    'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
  >,
): Promise<void> {
  const all = await loadWorkouts();
  const updates: Array<
    Pick<
      WorkoutExercise,
      'id' | 'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
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
  const logs = await loadLoggedWorkouts();
  const nextLogs = logs.map((log) => ({
    ...log,
    exercises: log.exercises.map((lex) =>
      affectedIds.has(lex.workoutExerciseId)
        ? {
            ...lex,
            activityType: nextDef.activityType,
            name: nextDef.name,
            sets: nextDef.sets,
            reps: nextDef.reps,
            weightKg: nextDef.weightKg,
            durationMinutes: nextDef.durationMinutes,
            distanceMiles: nextDef.distanceMiles,
            score: nextDef.score,
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
    'activityType' | 'name' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'
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
