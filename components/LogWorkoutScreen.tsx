import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { SessionDateTimeField } from '@/components/SessionDateTimeField';
import { CardioDistanceUnitPicker } from '@/components/CardioDistanceUnitPicker';
import { DurationUnitPicker } from '@/components/DurationUnitPicker';
import { ScoreUnitPicker } from '@/components/ScoreUnitPicker';
import { WeightUnitPicker } from '@/components/WeightUnitPicker';
import { StickySaveFooter } from '@/components/StickySaveFooter';
import { Text, View } from '@/components/Themed';
import { WorkoutIconGlyph } from '@/components/WorkoutIconGlyph';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  clearLogWorkoutSession,
  resolveLogWorkoutSession,
  type LogWorkoutSession,
} from '@/lib/logWorkoutNavigation';
import { themedAlert } from '@/lib/themedAlert';
import { newId } from '@/lib/ids';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import {
  buildDraftCardioPerActualSets,
  cardioPerSegmentCount,
  cardioPerSegmentLabel,
  perSegmentObjectiveInputValue,
  resizeDraftCardioPerSets,
  resolveCardioPerSegmentObjectiveTotal,
} from '@/lib/cardioPerLog';
import {
  getCardioLogLayout,
  isCardioDistancePerDuration,
  isCardioDurationPerDistance,
  normalizeCardioObjective,
  normalizeCardioDurationTracking,
  normalizeCardioDistanceTracking,
  normalizeCardioPlanFields,
  type LegacyCardioDistanceMode,
} from '@/lib/cardioPlan';
import { readStretchSetsFromExercise, stretchActualSetsFromLogged } from '@/lib/stretchSets';
import type { LoggedWorkout, LoggedWorkoutExercise, StretchSet, Workout } from '@/lib/types';
import { normalizeActivityType } from '@/lib/activityTypes';
import {
  formatCardioDistanceValue,
  normalizeCardioDistanceUnit,
  usesIntegerDistanceInput,
  type CardioDistanceUnit,
} from '@/lib/cardioDistanceUnits';
import {
  formatDurationValue,
  normalizeDurationUnit,
  usesIntegerDurationInput,
  type DurationUnit,
} from '@/lib/durationUnits';
import {
  normalizeScoreUnit,
  type ScoreUnit,
} from '@/lib/scoreUnits';
import { DEFAULT_WEIGHT_UNIT, formatWeightValue, normalizeWeightUnit, type WeightUnit } from '@/lib/weightUnits';
import { formatPlannedExerciseSummary } from '@/lib/exerciseDisplay';
import { hasLoggedExerciseInput, parseLoggedExerciseFromDraft } from '@/lib/logExerciseDraft';
import { resolveExerciseSetCount } from '@/lib/exerciseDraft';
import { clearNewLogDraft, isNewLogFormPristine, newLogDraftStorageKey } from '@/lib/logWorkoutDraft';
import { DEFAULT_WORKOUT_ICON_ID, type WorkoutIconId } from '@/lib/workoutIcons';
import { addLoggedWorkout, loadLoggedWorkouts, loadWorkouts, updateLoggedWorkout } from '@/lib/workoutsStorage';

type DraftActualSet = {
  id: string;
  actualRepsInput: string;
  actualWeightInput: string;
};

type DraftStretchActualSet = {
  id: string;
  actualDurationInput: string;
  actualDurationUnit: DurationUnit;
};

type DraftCardioPerActualSet = {
  id: string;
  actualDurationInput: string;
  actualDurationUnit: DurationUnit;
  actualDistanceInput: string;
  actualDistanceUnit: CardioDistanceUnit;
};

type DraftExercise = Omit<
  LoggedWorkoutExercise,
  | 'actualSets'
  | 'actualStretchSets'
  | 'actualCardioPerSets'
  | 'actualDuration'
  | 'actualDistance'
  | 'actualScore'
  | 'actualSetCount'
> & {
  actualSets: DraftActualSet[];
  actualStretchSets: DraftStretchActualSet[];
  actualCardioPerSets: DraftCardioPerActualSet[];
  /** Template per-set plan — used for planned-value toggle and summary. */
  stretchSets?: StretchSet[];
  actualDurationInput: string;
  actualDurationUnit: DurationUnit;
  actualDistanceInput: string;
  actualDistanceUnit: CardioDistanceUnit;
  actualScoreInput: string;
  actualScoreUnit: ScoreUnit;
};

type LogWorkoutDraft = {
  workoutId: string;
  /** When set, this draft belongs to editing an existing log (separate from new-log drafts). */
  loggedWorkoutId?: string;
  exercises: DraftExercise[];
  updatedAt: string;
  /** ISO timestamp for when the workout was performed. */
  sessionDate?: string;
  /** Template exercise ids (`WorkoutExercise.id`) the user removed from this log. */
  omittedWorkoutExerciseIds?: string[];
};

function parseSessionDateFromIso(iso: string | undefined, fallback: Date): Date {
  if (!iso) {
    return fallback;
  }
  const parsed = new Date(iso);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function hasActualSetValues(actualSet: DraftActualSet): boolean {
  return actualSet.actualRepsInput.trim().length > 0 && actualSet.actualWeightInput.trim().length > 0;
}

function draftStorageKey(workoutId: string): string {
  return `workout-log-draft@v1:${workoutId}`;
}

/** Legacy key — cleared when opening a saved log for edit (edit sessions no longer use drafts). */
function legacyEditDraftStorageKey(loggedWorkoutId: string): string {
  return `workout-log-draft-edit@v1:${loggedWorkoutId}`;
}

function loggedActualToDraftSet(
  as: LoggedWorkoutExercise['actualSets'][number],
  weightUnit: WeightUnit,
): DraftActualSet {
  return {
    id: newId(),
    actualRepsInput: String(as.actualReps),
    actualWeightInput: formatWeightValue(as.actualWeight, weightUnit),
  };
}

function hasCardioObjectiveOnlyActualValues(exercise: DraftExercise): boolean {
  const layout = getCardioLogLayout(exercise);
  if (layout !== 'objective_only') {
    return false;
  }
  const plan = normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' });
  if (plan.cardioObjective === 'distance') {
    return exercise.actualDistanceInput.trim().length > 0;
  }
  return exercise.actualDurationInput.trim().length > 0;
}

function hasCardioTotalActualValues(exercise: DraftExercise): boolean {
  return exercise.actualDurationInput.trim().length > 0 && exercise.actualDistanceInput.trim().length > 0;
}

function hasCardioPerActualSetValues(exercise: DraftExercise, actualSet: DraftCardioPerActualSet): boolean {
  if (isCardioDurationPerDistance(exercise)) {
    return actualSet.actualDurationInput.trim().length > 0;
  }
  if (isCardioDistancePerDuration(exercise)) {
    return actualSet.actualDistanceInput.trim().length > 0;
  }
  return false;
}

function hasCardioPerSegmentObjectiveValue(exercise: DraftExercise): boolean {
  return isCardioDurationPerDistance(exercise)
    ? exercise.actualDistanceInput.trim().length > 0
    : exercise.actualDurationInput.trim().length > 0;
}

function perSegmentObjectiveInputForExercise(exercise: DraftExercise): string {
  return isCardioDurationPerDistance(exercise)
    ? exercise.actualDistanceInput
    : exercise.actualDurationInput;
}

function hasSportActualValues(exercise: DraftExercise): boolean {
  return exercise.actualDurationInput.trim().length > 0 || exercise.actualScoreInput.trim().length > 0;
}

function hasStretchActualSetValues(actualSet: DraftStretchActualSet): boolean {
  return actualSet.actualDurationInput.trim().length > 0;
}

function plannedStretchDurationUnitForSet(
  exercise: Pick<DraftExercise, 'sets' | 'duration' | 'durationUnit' | 'stretchSets'>,
  setIndex: number,
): DurationUnit {
  const planned = readStretchSetsFromExercise(exercise);
  const plannedSet = planned[setIndex] ?? planned[0];
  return plannedSet?.durationUnit ?? exercise.durationUnit;
}

function buildDraftStretchActualSets(
  exercise: Pick<Workout['exercises'][number], 'activityType' | 'sets' | 'duration' | 'durationUnit' | 'stretchSets'>,
  loggedSets: LoggedWorkoutExercise['actualStretchSets'],
): DraftStretchActualSet[] {
  const planned = readStretchSetsFromExercise(exercise);
  const rows = stretchActualSetsFromLogged(loggedSets, planned);
  const setCount = Math.max(rows.length, planned.length, exercise.sets, 1);
  return Array.from({ length: setCount }, (_, setIndex) => {
    const row = rows[setIndex];
    const plannedSet = planned[setIndex] ?? planned[0];
    return {
      id: newId(),
      actualDurationInput: row?.actualDurationInput ?? '',
      actualDurationUnit: plannedSet?.durationUnit ?? exercise.durationUnit,
    };
  });
}

function loggedExerciseToDraftExercise(loggedExercise: LoggedWorkoutExercise): DraftExercise {
  const perSegmentObjectiveInput =
    loggedExercise.activityType === 'cardio' && getCardioLogLayout(loggedExercise) === 'per_segment'
      ? isCardioDurationPerDistance(loggedExercise)
        ? loggedExercise.actualDistance > 0
          ? formatCardioDistanceValue(loggedExercise.actualDistance, loggedExercise.distanceUnit)
          : ''
        : loggedExercise.actualDuration > 0
          ? formatDurationValue(loggedExercise.actualDuration, loggedExercise.durationUnit)
          : ''
      : '';
  const cardioPerDraft =
    loggedExercise.activityType === 'cardio' && getCardioLogLayout(loggedExercise) === 'per_segment'
      ? buildDraftCardioPerActualSets(
          loggedExercise,
          loggedExercise.actualCardioPerSets ?? [],
          perSegmentObjectiveInput,
        ).map((set) => ({
          id: newId(),
          ...set,
        }))
      : [];

  return {
    id: loggedExercise.id,
    workoutExerciseId: loggedExercise.workoutExerciseId,
    activityType: loggedExercise.activityType,
    name: loggedExercise.name,
    sets: loggedExercise.sets,
    reps: loggedExercise.reps,
    weight: loggedExercise.weight,
    weightUnit: loggedExercise.weightUnit,
    duration: loggedExercise.duration,
    durationUnit: loggedExercise.durationUnit,
    distance: loggedExercise.distance,
    distanceUnit: loggedExercise.distanceUnit,
    cardioObjective: loggedExercise.cardioObjective,
    cardioDurationTracking: loggedExercise.cardioDurationTracking,
    cardioDistanceTracking: loggedExercise.cardioDistanceTracking,
    score: loggedExercise.score,
    scoreUnit: loggedExercise.scoreUnit,
    actualSets:
      loggedExercise.activityType === 'strength'
        ? loggedExercise.actualSets.map((actualSet) =>
            loggedActualToDraftSet(actualSet, loggedExercise.actualWeightUnit),
          )
        : [],
    actualStretchSets:
      loggedExercise.activityType === 'stretch'
        ? buildDraftStretchActualSets(
            {
              activityType: loggedExercise.activityType,
              sets: loggedExercise.sets,
              duration: loggedExercise.duration,
              durationUnit: loggedExercise.durationUnit,
              stretchSets: loggedExercise.stretchSets,
            },
            loggedExercise.actualStretchSets,
          )
        : [],
    actualCardioPerSets: cardioPerDraft,
    stretchSets: loggedExercise.stretchSets,
    actualDurationInput:
      loggedExercise.actualDuration > 0
        ? formatDurationValue(loggedExercise.actualDuration, loggedExercise.durationUnit)
        : '',
    actualDurationUnit: loggedExercise.durationUnit,
    actualDistanceInput:
      loggedExercise.actualDistance > 0
        ? formatCardioDistanceValue(loggedExercise.actualDistance, loggedExercise.distanceUnit)
        : '',
    actualDistanceUnit: loggedExercise.distanceUnit,
    actualScoreInput: loggedExercise.actualScore,
    actualScoreUnit: loggedExercise.scoreUnit,
    actualWeightUnit: loggedExercise.weightUnit,
  };
}

function emptyDraftForTemplateExercise(exercise: Workout['exercises'][number]): DraftExercise {
  const base: DraftExercise = {
    id: newId(),
    workoutExerciseId: exercise.id,
    activityType: exercise.activityType,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weight: exercise.weight,
    weightUnit: exercise.weightUnit,
    duration: exercise.duration,
    durationUnit: exercise.durationUnit,
    distance: exercise.distance,
    distanceUnit: exercise.distanceUnit,
    cardioObjective: exercise.cardioObjective,
    cardioDurationTracking: exercise.cardioDurationTracking,
    cardioDistanceTracking: exercise.cardioDistanceTracking,
    score: exercise.score,
    scoreUnit: exercise.scoreUnit,
    actualSets: [],
    actualStretchSets: [],
    actualCardioPerSets: [],
    stretchSets: exercise.stretchSets,
    actualDurationInput: '',
    actualDurationUnit: exercise.durationUnit,
    actualDistanceInput: '',
    actualDistanceUnit: exercise.distanceUnit,
    actualScoreInput: '',
    actualScoreUnit: exercise.scoreUnit,
    actualWeightUnit: exercise.weightUnit,
  };

  if (exercise.activityType === 'strength') {
    const setCount = Math.max(exercise.sets, 1);
    return {
      ...base,
      actualSets: Array.from({ length: setCount }, () => ({
        id: newId(),
        actualRepsInput: '',
        actualWeightInput: '',
      })),
    };
  }

  if (exercise.activityType === 'stretch') {
    return {
      ...base,
      actualStretchSets: buildDraftStretchActualSets(exercise, []),
    };
  }

  if (exercise.activityType === 'cardio' && getCardioLogLayout(exercise) === 'per_segment') {
    return {
      ...base,
      actualCardioPerSets: buildDraftCardioPerActualSets(exercise, []).map((set) => ({
        id: newId(),
        ...set,
      })),
    };
  }

  return base;
}

function buildSavedDraftQueues(savedList: DraftExercise[]): Map<string, DraftExercise[]> {
  const queues = new Map<string, DraftExercise[]>();
  for (const exercise of savedList) {
    if (!exercise || typeof exercise.workoutExerciseId !== 'string') {
      continue;
    }
    const queue = queues.get(exercise.workoutExerciseId) ?? [];
    queue.push(exercise);
    queues.set(exercise.workoutExerciseId, queue);
  }
  return queues;
}

function takeSavedDraftForTemplateExercise(
  savedQueues: Map<string, DraftExercise[]>,
  workoutExerciseId: string,
): DraftExercise | undefined {
  const queue = savedQueues.get(workoutExerciseId);
  if (!queue || queue.length === 0) {
    return undefined;
  }
  return queue.shift();
}

function ensureUniqueDraftExerciseIds(exercises: DraftExercise[]): DraftExercise[] {
  const seen = new Set<string>();
  return exercises.map((exercise) => {
    if (!seen.has(exercise.id)) {
      seen.add(exercise.id);
      return exercise;
    }
    const id = newId();
    seen.add(id);
    return { ...exercise, id };
  });
}

function buildLoggedExerciseQueues(
  loggedExercises: LoggedWorkoutExercise[],
): Map<string, LoggedWorkoutExercise[]> {
  const queues = new Map<string, LoggedWorkoutExercise[]>();
  for (const exercise of loggedExercises) {
    const queue = queues.get(exercise.workoutExerciseId) ?? [];
    queue.push(exercise);
    queues.set(exercise.workoutExerciseId, queue);
  }
  return queues;
}

function takeLoggedExerciseForTemplate(
  loggedQueues: Map<string, LoggedWorkoutExercise[]>,
  workoutExerciseId: string,
): LoggedWorkoutExercise | undefined {
  const queue = loggedQueues.get(workoutExerciseId);
  if (!queue || queue.length === 0) {
    return undefined;
  }
  return queue.shift();
}

/** Hydrate the log form from a saved session plus the current template (new template exercises get empty actuals). */
function buildDraftExercisesFromLogged(logged: LoggedWorkout, template: Workout): DraftExercise[] {
  const loggedQueues = buildLoggedExerciseQueues(logged.exercises);
  const templateIds = new Set(template.exercises.map((e) => e.id));
  const out: DraftExercise[] = [];

  for (const te of template.exercises) {
    const le = takeLoggedExerciseForTemplate(loggedQueues, te.id);
    if (le) {
      out.push(loggedExerciseToDraftExercise(le));
    } else {
      out.push(emptyDraftForTemplateExercise(te));
    }
  }

  for (const le of logged.exercises) {
    if (!templateIds.has(le.workoutExerciseId)) {
      out.push(loggedExerciseToDraftExercise(le));
    }
  }

  return ensureUniqueDraftExerciseIds(out);
}

function parseDraftExercisesFromStorage(raw: unknown): DraftExercise[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const out: DraftExercise[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const o = item as Record<string, unknown>;
    if (
      typeof o.id !== 'string' ||
      typeof o.workoutExerciseId !== 'string' ||
      typeof o.name !== 'string' ||
      typeof o.sets !== 'number' ||
      typeof o.reps !== 'number' ||
      (typeof o.weight !== 'number' && typeof o.weightKg !== 'number')
    ) {
      return null;
    }
    if (!Array.isArray(o.actualSets)) {
      return null;
    }
    const actualSets: DraftActualSet[] = [];
    for (const s of o.actualSets) {
      if (!s || typeof s !== 'object') {
        return null;
      }
      const so = s as Record<string, unknown>;
      if (typeof so.id !== 'string') {
        return null;
      }
      actualSets.push({
        id: so.id,
        actualRepsInput: typeof so.actualRepsInput === 'string' ? so.actualRepsInput : '',
        actualWeightInput:
          typeof so.actualWeightInput === 'string'
            ? so.actualWeightInput
            : typeof so.actualWeightKgInput === 'string'
              ? so.actualWeightKgInput
              : '',
      });
    }
    const actualStretchSets: DraftStretchActualSet[] = [];
    if (Array.isArray(o.actualStretchSets)) {
      for (const s of o.actualStretchSets) {
        if (!s || typeof s !== 'object') {
          return null;
        }
        const so = s as Record<string, unknown>;
        actualStretchSets.push({
          id: typeof so.id === 'string' ? so.id : newId(),
          actualDurationInput: typeof so.actualDurationInput === 'string' ? so.actualDurationInput : '',
          actualDurationUnit:
            typeof so.actualDurationUnit === 'string'
              ? normalizeDurationUnit(so.actualDurationUnit)
              : normalizeDurationUnit(undefined),
        });
      }
    }
    const actualCardioPerSets: DraftCardioPerActualSet[] = [];
    if (Array.isArray(o.actualCardioPerSets)) {
      for (const s of o.actualCardioPerSets) {
        if (!s || typeof s !== 'object') {
          return null;
        }
        const so = s as Record<string, unknown>;
        actualCardioPerSets.push({
          id: typeof so.id === 'string' ? so.id : newId(),
          actualDurationInput: typeof so.actualDurationInput === 'string' ? so.actualDurationInput : '',
          actualDurationUnit:
            typeof so.actualDurationUnit === 'string'
              ? normalizeDurationUnit(so.actualDurationUnit)
              : normalizeDurationUnit(undefined),
          actualDistanceInput: typeof so.actualDistanceInput === 'string' ? so.actualDistanceInput : '',
          actualDistanceUnit:
            typeof so.actualDistanceUnit === 'string'
              ? normalizeCardioDistanceUnit(so.actualDistanceUnit)
              : normalizeCardioDistanceUnit(undefined),
        });
      }
    }
    if (actualStretchSets.length === 0 && normalizeActivityType(o.activityType) === 'stretch') {
      const legacyCountRaw = typeof o.actualSetCountInput === 'string' ? o.actualSetCountInput.trim() : '';
      const legacyDurationRaw =
        typeof o.actualDurationInput === 'string'
          ? o.actualDurationInput
          : typeof o.actualDurationMinutesInput === 'string'
            ? o.actualDurationMinutesInput
            : '';
      const legacyCount = Number.parseInt(legacyCountRaw, 10);
      const setCount = Number.isFinite(legacyCount) && legacyCount > 0 ? legacyCount : 1;
      const legacyDurationUnit =
        typeof o.actualDurationUnit === 'string'
          ? normalizeDurationUnit(o.actualDurationUnit)
          : normalizeDurationUnit(undefined);
      for (let i = 0; i < setCount; i++) {
        actualStretchSets.push({
          id: newId(),
          actualDurationInput: legacyDurationRaw,
          actualDurationUnit: legacyDurationUnit,
        });
      }
    }
    out.push({
      id: o.id,
      workoutExerciseId: o.workoutExerciseId,
      activityType: normalizeActivityType(o.activityType),
      name: o.name,
      sets: o.sets,
      reps: o.reps,
      weight:
        typeof o.weight === 'number'
          ? o.weight
          : typeof o.weightKg === 'number'
            ? o.weightKg
            : 0,
      weightUnit:
        typeof o.weightUnit === 'string'
          ? normalizeWeightUnit(o.weightUnit)
          : DEFAULT_WEIGHT_UNIT,
      duration:
        typeof o.duration === 'number'
          ? o.duration
          : typeof o.durationMinutes === 'number'
            ? o.durationMinutes
            : 0,
      durationUnit:
        typeof o.durationUnit === 'string'
          ? normalizeDurationUnit(o.durationUnit)
          : normalizeDurationUnit(undefined),
      distance:
        typeof o.distance === 'number'
          ? o.distance
          : typeof o.distanceMiles === 'number'
            ? o.distanceMiles
            : 0,
      distanceUnit:
        typeof o.distanceUnit === 'string'
          ? normalizeCardioDistanceUnit(o.distanceUnit)
          : normalizeCardioDistanceUnit(undefined),
      cardioObjective:
        normalizeActivityType(o.activityType) === 'cardio'
          ? normalizeCardioObjective(o.cardioObjective)
          : undefined,
      cardioDurationTracking:
        normalizeActivityType(o.activityType) === 'cardio'
          ? normalizeCardioDurationTracking(o.cardioDurationTracking)
          : undefined,
      cardioDistanceTracking:
        normalizeActivityType(o.activityType) === 'cardio'
          ? normalizeCardioDistanceTracking(o.cardioDistanceTracking)
          : undefined,
      cardioDistanceMode:
        normalizeActivityType(o.activityType) === 'cardio' && typeof o.cardioDistanceMode === 'string'
          ? (o.cardioDistanceMode as LegacyCardioDistanceMode)
          : undefined,
      score: typeof o.score === 'string' ? o.score : '',
      scoreUnit:
        typeof o.scoreUnit === 'string'
          ? normalizeScoreUnit(o.scoreUnit)
          : normalizeScoreUnit(undefined),
      actualSets,
      actualStretchSets,
      actualCardioPerSets,
      stretchSets: undefined,
      actualDurationInput:
        typeof o.actualDurationInput === 'string'
          ? o.actualDurationInput
          : typeof o.actualDurationMinutesInput === 'string'
            ? o.actualDurationMinutesInput
            : '',
      actualDurationUnit:
        typeof o.actualDurationUnit === 'string'
          ? normalizeDurationUnit(o.actualDurationUnit)
          : typeof o.durationUnit === 'string'
            ? normalizeDurationUnit(o.durationUnit)
            : normalizeDurationUnit(undefined),
      actualDistanceInput:
        typeof o.actualDistanceInput === 'string'
          ? o.actualDistanceInput
          : typeof o.actualDistanceMilesInput === 'string'
            ? o.actualDistanceMilesInput
            : '',
      actualDistanceUnit:
        typeof o.actualDistanceUnit === 'string'
          ? normalizeCardioDistanceUnit(o.actualDistanceUnit)
          : typeof o.distanceUnit === 'string'
            ? normalizeCardioDistanceUnit(o.distanceUnit)
            : normalizeCardioDistanceUnit(undefined),
      actualScoreInput: typeof o.actualScoreInput === 'string' ? o.actualScoreInput : '',
      actualScoreUnit:
        typeof o.actualScoreUnit === 'string'
          ? normalizeScoreUnit(o.actualScoreUnit)
          : typeof o.scoreUnit === 'string'
            ? normalizeScoreUnit(o.scoreUnit)
            : normalizeScoreUnit(undefined),
      actualWeightUnit:
        typeof o.actualWeightUnit === 'string'
          ? normalizeWeightUnit(o.actualWeightUnit)
          : typeof o.weightUnit === 'string'
            ? normalizeWeightUnit(o.weightUnit)
            : DEFAULT_WEIGHT_UNIT,
    });
  }
  return out;
}

function normalizeDraftExercises(
  workout: Workout,
  savedExercises: unknown,
  omittedWorkoutExerciseIds: readonly string[] = [],
): DraftExercise[] {
  const omit = new Set(omittedWorkoutExerciseIds);
  const savedList = Array.isArray(savedExercises) ? (savedExercises as DraftExercise[]) : [];
  const savedQueues = buildSavedDraftQueues(savedList);
  return ensureUniqueDraftExerciseIds(
    workout.exercises
    .filter((exercise) => !omit.has(exercise.id))
    .map((exercise) => {
      const saved = takeSavedDraftForTemplateExercise(savedQueues, exercise.id);
      const savedStrengthLen = saved?.actualSets?.length ?? 0;
      const strengthSetCount =
        exercise.activityType === 'strength' ? Math.max(exercise.sets, savedStrengthLen, 1) : 0;
      const plannedStretch = readStretchSetsFromExercise(exercise);
      const savedStretchLen = saved?.actualStretchSets?.length ?? 0;
      const stretchSetCount =
        exercise.activityType === 'stretch'
          ? Math.max(plannedStretch.length, exercise.sets, savedStretchLen, 1)
          : 0;
      return {
        id: saved?.id && typeof saved.id === 'string' ? saved.id : newId(),
        workoutExerciseId: exercise.id,
        activityType: saved?.activityType ?? exercise.activityType,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        weightUnit: exercise.weightUnit,
        duration: exercise.duration,
        durationUnit: exercise.durationUnit,
        distance: exercise.distance,
        distanceUnit: exercise.distanceUnit,
        cardioObjective: exercise.cardioObjective,
    cardioDurationTracking: exercise.cardioDurationTracking,
    cardioDistanceTracking: exercise.cardioDistanceTracking,
        score: exercise.score,
        scoreUnit: exercise.scoreUnit,
        stretchSets: exercise.stretchSets,
        actualSets:
          exercise.activityType === 'strength'
            ? Array.from({ length: strengthSetCount }, (_, setIndex) => {
                const savedSet = saved?.actualSets?.[setIndex];
                return {
                  id: savedSet?.id && typeof savedSet.id === 'string' ? savedSet.id : newId(),
                  actualRepsInput: typeof savedSet?.actualRepsInput === 'string' ? savedSet.actualRepsInput : '',
                  actualWeightInput:
                    typeof savedSet?.actualWeightInput === 'string'
                      ? savedSet.actualWeightInput
                      : typeof (savedSet as unknown as { actualWeightKgInput?: string } | undefined)?.actualWeightKgInput === 'string'
                        ? (savedSet as unknown as { actualWeightKgInput: string }).actualWeightKgInput
                        : '',
                };
              })
            : [],
        actualStretchSets:
          exercise.activityType === 'stretch'
            ? Array.from({ length: stretchSetCount }, (_, setIndex) => {
                const savedSet = saved?.actualStretchSets?.[setIndex];
                const plannedSet = plannedStretch[setIndex] ?? plannedStretch[0];
                return {
                  id: savedSet?.id && typeof savedSet.id === 'string' ? savedSet.id : newId(),
                  actualDurationInput:
                    typeof savedSet?.actualDurationInput === 'string' ? savedSet.actualDurationInput : '',
                  actualDurationUnit: plannedSet?.durationUnit ?? exercise.durationUnit,
                };
              })
            : [],
        actualCardioPerSets:
          exercise.activityType === 'cardio' && getCardioLogLayout(exercise) === 'per_segment'
            ? (() => {
                const objectiveInput = isCardioDurationPerDistance(exercise)
                  ? typeof saved?.actualDistanceInput === 'string'
                    ? saved.actualDistanceInput
                    : ''
                  : typeof saved?.actualDurationInput === 'string'
                    ? saved.actualDurationInput
                    : '';
                const built = buildDraftCardioPerActualSets(exercise, [], objectiveInput);
                return built.map((builtSet, setIndex) => {
                  const savedSet = saved?.actualCardioPerSets?.[setIndex];
                  return {
                    id: savedSet?.id && typeof savedSet.id === 'string' ? savedSet.id : newId(),
                    actualDurationInput:
                      typeof savedSet?.actualDurationInput === 'string'
                        ? savedSet.actualDurationInput
                        : builtSet.actualDurationInput,
                    actualDurationUnit: builtSet.actualDurationUnit,
                    actualDistanceInput:
                      typeof savedSet?.actualDistanceInput === 'string'
                        ? savedSet.actualDistanceInput
                        : builtSet.actualDistanceInput,
                    actualDistanceUnit: builtSet.actualDistanceUnit,
                  };
                });
              })()
            : [],
        actualDurationInput:
          typeof saved?.actualDurationInput === 'string'
            ? saved.actualDurationInput
            : typeof (saved as unknown as { actualDurationMinutesInput?: string } | undefined)?.actualDurationMinutesInput === 'string'
              ? (saved as unknown as { actualDurationMinutesInput: string }).actualDurationMinutesInput
              : '',
        actualDurationUnit: exercise.durationUnit,
        actualDistanceInput:
          typeof saved?.actualDistanceInput === 'string'
            ? saved.actualDistanceInput
            : typeof (saved as unknown as { actualDistanceMilesInput?: string } | undefined)?.actualDistanceMilesInput === 'string'
              ? (saved as unknown as { actualDistanceMilesInput: string }).actualDistanceMilesInput
              : '',
        actualDistanceUnit: exercise.distanceUnit,
        actualScoreInput: typeof saved?.actualScoreInput === 'string' ? saved.actualScoreInput : '',
        actualScoreUnit: exercise.scoreUnit,
        actualWeightUnit: exercise.weightUnit,
      };
    }),
  );
}

function toDraftExercises(workout: Workout): DraftExercise[] {
  return ensureUniqueDraftExerciseIds(
    workout.exercises.map((exercise) => emptyDraftForTemplateExercise(exercise)),
  );
}

export default function LogWorkoutScreen() {
  const params = useLocalSearchParams<{
    workoutId?: string | string[];
    loggedWorkoutId?: string | string[];
    logIntent?: string | string[];
    t?: string | string[];
  }>();
  const session: LogWorkoutSession | null = useMemo(
    () => resolveLogWorkoutSession(params),
    [params.workoutId, params.loggedWorkoutId, params.logIntent, params.t],
  );
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [omittedWorkoutExerciseIds, setOmittedWorkoutExerciseIds] = useState<string[]>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [loadedFromDraft, setLoadedFromDraft] = useState(false);
  const [displayIconId, setDisplayIconId] = useState<WorkoutIconId>(DEFAULT_WORKOUT_ICON_ID);
  const [sessionDate, setSessionDate] = useState(() => new Date());
  const skipAutosaveRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const initialSessionDateRef = useRef<Date>(new Date());
  const draftSnapshotRef = useRef({
    workout: null as Workout | null,
    exercises: [] as DraftExercise[],
    omittedWorkoutExerciseIds: [] as string[],
    sessionDate: new Date(),
    session: null as LogWorkoutSession | null,
  });

  useEffect(() => {
    if (!session) {
      themedAlert('Workout not found', 'Please start from a workout card to log this session.');
      router.replace('/');
      return;
    }

    const { workoutId, loggedWorkoutId, intent } = session;
    const loadGeneration = ++loadGenerationRef.current;

    if (!workoutId) {
      themedAlert('Workout not found', 'Please start from a workout card to log this session.');
      router.replace('/');
      return;
    }

    if (intent === 'edit' && !loggedWorkoutId) {
      themedAlert('Log not found', 'Could not open this logged workout for editing.');
      router.replace('/workout-log');
      return;
    }

    skipAutosaveRef.current = true;
    setLoading(true);
    setDraftHydrated(false);
    setLoadedFromDraft(false);

    void (async () => {
      const allWorkouts = await loadWorkouts();
      if (loadGeneration !== loadGenerationRef.current) {
        return;
      }

      const selectedWorkout = allWorkouts.find((entry) => entry.id === workoutId);
      if (!selectedWorkout) {
        themedAlert('Workout not found', 'Could not find the workout template for this log.');
        router.replace('/');
        return;
      }

      let nextExercises: DraftExercise[];
      let nextOmitted: string[] = [];
      let didLoadDraft = false;
      let iconIdForHeader = selectedWorkout.iconId;
      let nextSessionDate = new Date();

      if (intent === 'edit' && loggedWorkoutId) {
        const allLogged = await loadLoggedWorkouts();
        if (loadGeneration !== loadGenerationRef.current) {
          return;
        }

        const logged = allLogged.find((l) => l.id === loggedWorkoutId);
        if (!logged) {
          themedAlert('Log not found', 'This logged workout no longer exists.');
          router.replace('/workout-log');
          return;
        }
        if (logged.workoutId !== workoutId) {
          themedAlert('Workout mismatch', 'This log does not match the selected workout template.');
          router.replace('/workout-log');
          return;
        }

        await AsyncStorage.removeItem(legacyEditDraftStorageKey(loggedWorkoutId));
        iconIdForHeader = logged.iconId;
        nextSessionDate = parseSessionDateFromIso(logged.createdAt, new Date());
        nextExercises = buildDraftExercisesFromLogged(logged, selectedWorkout);
        nextOmitted = [];
      } else {
        const storageKey = newLogDraftStorageKey(selectedWorkout.id);
        const rawDraft = await AsyncStorage.getItem(storageKey);
        nextExercises = toDraftExercises(selectedWorkout);
        nextOmitted = [];
        if (rawDraft) {
          try {
            const parsed = JSON.parse(rawDraft) as LogWorkoutDraft;
            if (parsed && parsed.workoutId === selectedWorkout.id && !parsed.loggedWorkoutId) {
              const omittedRaw = parsed.omittedWorkoutExerciseIds;
              nextOmitted = Array.isArray(omittedRaw)
                ? omittedRaw.filter((id): id is string => typeof id === 'string')
                : [];
              nextExercises = normalizeDraftExercises(selectedWorkout, parsed.exercises, nextOmitted);
              nextSessionDate = parseSessionDateFromIso(parsed.sessionDate, new Date());
              didLoadDraft = true;
            }
          } catch {
            nextExercises = toDraftExercises(selectedWorkout);
            nextOmitted = [];
          }
        }
      }

      if (loadGeneration !== loadGenerationRef.current) {
        return;
      }

      setWorkout(selectedWorkout);
      setDisplayIconId(iconIdForHeader);
      setOmittedWorkoutExerciseIds(nextOmitted);
      setExercises(nextExercises);
      setSessionDate(nextSessionDate);
      initialSessionDateRef.current = nextSessionDate;
      setLoadedFromDraft(didLoadDraft);
      setDraftHydrated(true);
      setLoading(false);
      skipAutosaveRef.current = false;
    })();
  }, [session?.workoutId, session?.loggedWorkoutId, session?.intent]);

  useEffect(() => {
    if (
      !session ||
      session.intent !== 'new' ||
      !workout ||
      !draftHydrated ||
      skipAutosaveRef.current ||
      loading
    ) {
      return;
    }

    const sessionDateChanged = sessionDate.getTime() !== initialSessionDateRef.current.getTime();
    if (isNewLogFormPristine(workout, exercises, omittedWorkoutExerciseIds) && !sessionDateChanged) {
      void clearNewLogDraft(workout.id);
      return;
    }

    void AsyncStorage.setItem(
      newLogDraftStorageKey(workout.id),
      JSON.stringify({
        workoutId: workout.id,
        exercises,
        omittedWorkoutExerciseIds,
        sessionDate: sessionDate.toISOString(),
        updatedAt: new Date().toISOString(),
      } as LogWorkoutDraft),
    );
  }, [draftHydrated, exercises, loading, omittedWorkoutExerciseIds, session, sessionDate, workout]);

  draftSnapshotRef.current = { workout, exercises, omittedWorkoutExerciseIds, sessionDate, session };

  useEffect(() => {
    return () => {
      if (skipAutosaveRef.current) {
        return;
      }
      const snap = draftSnapshotRef.current;
      if (!snap.workout || !snap.session || snap.session.intent !== 'new') {
        return;
      }
      const sessionDateChanged = snap.sessionDate.getTime() !== initialSessionDateRef.current.getTime();
      if (isNewLogFormPristine(snap.workout, snap.exercises, snap.omittedWorkoutExerciseIds) && !sessionDateChanged) {
        void clearNewLogDraft(snap.workout.id);
      }
    };
  }, []);

  const updateActualSetField = (
    exerciseId: string,
    actualSetId: string,
    field: keyof Pick<DraftActualSet, 'actualRepsInput' | 'actualWeightInput'>,
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        return {
          ...ex,
          actualSets: ex.actualSets.map((actualSet) =>
            actualSet.id === actualSetId ? { ...actualSet, [field]: value } : actualSet,
          ),
        };
      }),
    );
  };

  const toggleActualSetPlannedValues = (exerciseId: string, actualSetId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        const targetSet = ex.actualSets.find((actualSet) => actualSet.id === actualSetId);
        if (!targetSet) {
          return ex;
        }
        const isChecked = hasActualSetValues(targetSet);
        if (isChecked) {
          return {
            ...ex,
            actualSets: ex.actualSets.map((actualSet) =>
              actualSet.id === actualSetId ? { ...actualSet, actualRepsInput: '', actualWeightInput: '' } : actualSet,
            ),
          };
        }
        const plannedReps = String(ex.reps);
        const plannedWeight = formatWeightValue(ex.weight, ex.weightUnit);
        return {
          ...ex,
          actualWeightUnit: ex.weightUnit,
          actualSets: ex.actualSets.map((actualSet) =>
            actualSet.id === actualSetId
              ? { ...actualSet, actualRepsInput: plannedReps, actualWeightInput: plannedWeight }
              : actualSet,
          ),
        };
      }),
    );
  };

  const addActualSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        return {
          ...ex,
          actualSets: [
            ...ex.actualSets,
            {
              id: newId(),
              actualRepsInput: '',
              actualWeightInput: '',
            },
          ],
        };
      }),
    );
  };

  const confirmRemoveExerciseFromLog = (exercise: DraftExercise) => {
    themedAlert(
      'Remove exercise?',
      `Remove "${exercise.name}" from this session? It will stay out of this log until you start fresh or clear the draft.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setOmittedWorkoutExerciseIds((prev) =>
              prev.includes(exercise.workoutExerciseId) ? prev : [...prev, exercise.workoutExerciseId],
            );
            setExercises((prev) => prev.filter((ex) => ex.id !== exercise.id));
          },
        },
      ],
    );
  };

  const deleteActualSet = (exerciseId: string, actualSetId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        if (ex.actualSets.length <= 1) {
          themedAlert('Keep one set', 'Each exercise needs at least one set. Add another set before deleting this one.');
          return ex;
        }
        return {
          ...ex,
          actualSets: ex.actualSets.filter((set) => set.id !== actualSetId),
        };
      }),
    );
  };

  const updateExerciseActualField = (
    exerciseId: string,
    field: 'actualDurationInput' | 'actualDistanceInput' | 'actualScoreInput',
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        if (
          getCardioLogLayout(ex) === 'per_segment' &&
          ((field === 'actualDistanceInput' && perSegmentObjectiveInputValue(ex) === 'actualDistanceInput') ||
            (field === 'actualDurationInput' && perSegmentObjectiveInputValue(ex) === 'actualDurationInput'))
        ) {
          const next =
            field === 'actualDistanceInput'
              ? { ...ex, actualDistanceInput: value }
              : { ...ex, actualDurationInput: value };
          return {
            ...next,
            actualCardioPerSets: resizeDraftCardioPerSets(next, next.actualCardioPerSets, value, (row) => ({
              id: newId(),
              ...row,
            })),
          };
        }
        return { ...ex, [field]: value };
      }),
    );
  };

  const toggleCardioPerSegmentObjectivePlannedValues = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        const field = perSegmentObjectiveInputValue(ex);
        if (hasCardioPerSegmentObjectiveValue(ex)) {
          const cleared =
            field === 'actualDistanceInput'
              ? { ...ex, actualDistanceInput: '' }
              : { ...ex, actualDurationInput: '' };
          return {
            ...cleared,
            actualCardioPerSets: resizeDraftCardioPerSets(cleared, cleared.actualCardioPerSets, '', (row) => ({
              id: newId(),
              ...row,
            })),
          };
        }
        const plannedValue = isCardioDurationPerDistance(ex)
          ? ex.distance > 0
            ? formatCardioDistanceValue(ex.distance, ex.distanceUnit)
            : ''
          : ex.duration > 0
            ? formatDurationValue(ex.duration, ex.durationUnit)
            : '';
        const filled =
          field === 'actualDistanceInput'
            ? { ...ex, actualDistanceInput: plannedValue }
            : { ...ex, actualDurationInput: plannedValue };
        return {
          ...filled,
          actualCardioPerSets: resizeDraftCardioPerSets(filled, filled.actualCardioPerSets, plannedValue, (row) => ({
            id: newId(),
            ...row,
          })),
        };
      }),
    );
  };

  const toggleCardioObjectiveOnlyPlannedValues = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        if (hasCardioObjectiveOnlyActualValues(ex)) {
          const plan = normalizeCardioPlanFields({ ...ex, activityType: 'cardio' });
          if (plan.cardioObjective === 'distance') {
            return { ...ex, actualDistanceInput: '' };
          }
          return { ...ex, actualDurationInput: '' };
        }
        const plan = normalizeCardioPlanFields({ ...ex, activityType: 'cardio' });
        if (plan.cardioObjective === 'distance') {
          return {
            ...ex,
            actualDistanceInput:
              ex.distance > 0 ? formatCardioDistanceValue(ex.distance, ex.distanceUnit) : '',
            actualDistanceUnit: ex.distanceUnit,
          };
        }
        return {
          ...ex,
          actualDurationInput: ex.duration > 0 ? formatDurationValue(ex.duration, ex.durationUnit) : '',
          actualDurationUnit: ex.durationUnit,
        };
      }),
    );
  };

  const toggleCardioTotalPlannedValues = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        if (hasCardioTotalActualValues(ex)) {
          return { ...ex, actualDurationInput: '', actualDistanceInput: '' };
        }
        return {
          ...ex,
          actualDurationInput:
            ex.duration > 0 ? formatDurationValue(ex.duration, ex.durationUnit) : '',
          actualDurationUnit: ex.durationUnit,
          actualDistanceInput:
            ex.distance > 0 ? formatCardioDistanceValue(ex.distance, ex.distanceUnit) : '',
          actualDistanceUnit: ex.distanceUnit,
        };
      }),
    );
  };

  const toggleCardioPerActualSetPlannedValues = (exerciseId: string, actualSetId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        const setIndex = ex.actualCardioPerSets.findIndex((actualSet) => actualSet.id === actualSetId);
        if (setIndex < 0) {
          return ex;
        }
        const targetSet = ex.actualCardioPerSets[setIndex];
        if (hasCardioPerActualSetValues(ex, targetSet)) {
          return {
            ...ex,
            actualCardioPerSets: ex.actualCardioPerSets.map((actualSet) =>
              actualSet.id === actualSetId
                ? { ...actualSet, actualDurationInput: '', actualDistanceInput: '' }
                : actualSet,
            ),
          };
        }
        if (isCardioDurationPerDistance(ex)) {
          return {
            ...ex,
            actualCardioPerSets: ex.actualCardioPerSets.map((actualSet) =>
              actualSet.id === actualSetId
                ? {
                    ...actualSet,
                    actualDurationInput:
                      ex.duration > 0 ? formatDurationValue(ex.duration, ex.durationUnit) : '',
                    actualDurationUnit: ex.durationUnit,
                  }
                : actualSet,
            ),
          };
        }
        return {
          ...ex,
          actualCardioPerSets: ex.actualCardioPerSets.map((actualSet) =>
            actualSet.id === actualSetId
              ? {
                  ...actualSet,
                  actualDistanceInput:
                    ex.distance > 0 ? formatCardioDistanceValue(ex.distance, ex.distanceUnit) : '',
                  actualDistanceUnit: ex.distanceUnit,
                }
              : actualSet,
          ),
        };
      }),
    );
  };

  const updateCardioPerActualSetField = (
    exerciseId: string,
    actualSetId: string,
    field: 'actualDurationInput' | 'actualDistanceInput',
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        return {
          ...ex,
          actualCardioPerSets: ex.actualCardioPerSets.map((actualSet) =>
            actualSet.id === actualSetId ? { ...actualSet, [field]: value } : actualSet,
          ),
        };
      }),
    );
  };

  const toggleSportPlannedValues = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        if (hasSportActualValues(ex)) {
          return { ...ex, actualDurationInput: '', actualScoreInput: '' };
        }
        return {
          ...ex,
          actualDurationInput:
            ex.duration > 0 ? formatDurationValue(ex.duration, ex.durationUnit) : '',
          actualDurationUnit: ex.durationUnit,
          actualScoreInput: ex.score,
          actualScoreUnit: ex.scoreUnit,
        };
      }),
    );
  };

  const toggleStretchActualSetPlannedValues = (exerciseId: string, actualSetId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        const setIndex = ex.actualStretchSets.findIndex((actualSet) => actualSet.id === actualSetId);
        if (setIndex < 0) {
          return ex;
        }
        const targetSet = ex.actualStretchSets[setIndex];
        if (hasStretchActualSetValues(targetSet)) {
          return {
            ...ex,
            actualStretchSets: ex.actualStretchSets.map((actualSet) =>
              actualSet.id === actualSetId ? { ...actualSet, actualDurationInput: '' } : actualSet,
            ),
          };
        }
        const planned = readStretchSetsFromExercise({
          sets: ex.sets,
          duration: ex.duration,
          durationUnit: ex.durationUnit,
          stretchSets: ex.stretchSets,
        });
        const plannedSet = planned[setIndex] ?? planned[0];
        return {
          ...ex,
          actualStretchSets: ex.actualStretchSets.map((actualSet) =>
            actualSet.id === actualSetId
              ? {
                  ...actualSet,
                  actualDurationInput:
                    plannedSet && plannedSet.duration > 0
                      ? formatDurationValue(plannedSet.duration, plannedSet.durationUnit)
                      : '',
                  actualDurationUnit: plannedSet?.durationUnit ?? ex.durationUnit,
                }
              : actualSet,
          ),
        };
      }),
    );
  };

  const updateStretchActualSetField = (
    exerciseId: string,
    actualSetId: string,
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        return {
          ...ex,
          actualStretchSets: ex.actualStretchSets.map((actualSet) =>
            actualSet.id === actualSetId ? { ...actualSet, actualDurationInput: value } : actualSet,
          ),
        };
      }),
    );
  };

  const addStretchActualSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        return {
          ...ex,
          actualStretchSets: [
            ...ex.actualStretchSets,
            {
              id: newId(),
              actualDurationInput: '',
              actualDurationUnit: ex.durationUnit,
            },
          ],
        };
      }),
    );
  };

  const deleteStretchActualSet = (exerciseId: string, actualSetId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        if (ex.actualStretchSets.length <= 1) {
          themedAlert('Keep one set', 'Each exercise needs at least one set. Add another set before deleting this one.');
          return ex;
        }
        return {
          ...ex,
          actualStretchSets: ex.actualStretchSets.filter((set) => set.id !== actualSetId),
        };
      }),
    );
  };

  const parseWorkout = (): { workout: Workout; exercises: LoggedWorkoutExercise[] } | null => {
    if (!workout) {
      return null;
    }

    const parsedExercises: LoggedWorkoutExercise[] = [];

    for (const ex of exercises) {
      const parsedActual = parseLoggedExerciseFromDraft(
        {
          activityType: ex.activityType,
          actualSets: ex.actualSets,
          actualWeightUnit: ex.weightUnit,
          actualStretchSets: ex.actualStretchSets.map((set, setIndex) => ({
            actualDurationInput: set.actualDurationInput,
            actualDurationUnit: plannedStretchDurationUnitForSet(ex, setIndex),
          })),
          actualCardioPerSets: ex.actualCardioPerSets.map((set) => ({
            actualDurationInput: set.actualDurationInput,
            actualDurationUnit: set.actualDurationUnit,
            actualDistanceInput: set.actualDistanceInput,
            actualDistanceUnit: set.actualDistanceUnit,
          })),
          cardioObjective: ex.cardioObjective,
          cardioDurationTracking: ex.cardioDurationTracking,
          cardioDistanceTracking: ex.cardioDistanceTracking,
          cardioDistanceMode: ex.cardioDistanceMode,
          plannedDuration: ex.duration,
          plannedDistance: ex.distance,
          actualDurationInput: ex.actualDurationInput,
          actualDurationUnit: ex.durationUnit,
          actualDistanceInput: ex.actualDistanceInput,
          actualDistanceUnit: ex.distanceUnit,
          actualScoreInput: ex.actualScoreInput,
          actualScoreUnit: ex.scoreUnit,
        },
        ex.name,
      );
      if (!parsedActual.ok) {
        themedAlert(parsedActual.title, parsedActual.message);
        return null;
      }

      parsedExercises.push({
        id: ex.id,
        workoutExerciseId: ex.workoutExerciseId,
        activityType: ex.activityType,
        name: ex.name,
        sets:
          ex.activityType === 'strength' || ex.activityType === 'stretch'
            ? resolveExerciseSetCount(ex.sets)
            : ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        weightUnit: ex.weightUnit,
        duration: ex.duration,
        durationUnit: ex.durationUnit,
        distance: ex.distance,
        distanceUnit: ex.distanceUnit,
        cardioObjective: ex.cardioObjective,
        cardioDurationTracking: ex.cardioDurationTracking,
        cardioDistanceTracking: ex.cardioDistanceTracking,
        cardioDistanceMode: ex.cardioDistanceMode,
        score: ex.score,
        scoreUnit: ex.scoreUnit,
        stretchSets:
          ex.activityType === 'stretch'
            ? readStretchSetsFromExercise({
                sets: ex.sets,
                duration: ex.duration,
                durationUnit: ex.durationUnit,
                stretchSets: ex.stretchSets,
              })
            : undefined,
        ...parsedActual.exercise,
      });
    }

    if (parsedExercises.length === 0) {
      themedAlert('No exercises found', 'This workout has no exercises to log.');
      return null;
    }

    return { workout, exercises: parsedExercises };
  };

  const onSave = () => {
    if (sessionDate.getTime() > Date.now()) {
      themedAlert('Invalid date', 'Workout date and time cannot be in the future.');
      return;
    }

    const parsed = parseWorkout();
    if (!parsed) {
      return;
    }
    skipAutosaveRef.current = true;

    void (async () => {
      try {
        if (!session) {
          return;
        }
        const { loggedWorkoutId, intent } = session;
        const createdAt = sessionDate.toISOString();
        if (intent === 'edit' && loggedWorkoutId) {
          const updated = await updateLoggedWorkout(loggedWorkoutId, {
            workoutId: parsed.workout.id,
            title: parsed.workout.title,
            daysOfWeek: parsed.workout.daysOfWeek,
            iconId: parsed.workout.iconId,
            exercises: parsed.exercises,
            createdAt,
          });
          if (!updated) {
            skipAutosaveRef.current = false;
            themedAlert('Save failed', 'Could not find this logged workout. It may have been deleted.');
            return;
          }
        } else {
          await addLoggedWorkout({
            workoutId: parsed.workout.id,
            title: parsed.workout.title,
            daysOfWeek: parsed.workout.daysOfWeek,
            iconId: parsed.workout.iconId,
            exercises: parsed.exercises,
            createdAt,
          });
          await AsyncStorage.removeItem(newLogDraftStorageKey(parsed.workout.id));
        }
        clearLogWorkoutSession();
        router.replace('/');
      } catch {
        skipAutosaveRef.current = false;
        themedAlert('Save failed', 'Could not save this workout. Please try again.');
      }
    })();
  };

  const onStartFresh = () => {
    if (!workout) {
      return;
    }
    if (!session) {
      return;
    }
    if (session.intent === 'edit') {
      return;
    }
    themedAlert('Start a new log?', 'This will clear your current in-progress draft for this workout.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start fresh',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await AsyncStorage.removeItem(newLogDraftStorageKey(workout.id));
            const freshDate = new Date();
            setOmittedWorkoutExerciseIds([]);
            setExercises(toDraftExercises(workout));
            setSessionDate(freshDate);
            initialSessionDateRef.current = freshDate;
            setLoadedFromDraft(false);
          })();
        },
      },
    ]);
  };

  if (loading || !workout) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors[activeScheme].tint} />
      </View>
    );
  }

  return (
    <RNView style={styles.flex}>
      <Stack.Screen
        options={{
          title: session?.intent === 'edit' ? 'Edit log' : 'Log workout',
          ...stackHeaderHideIosBackLabel,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        keyboardVerticalOffset={80}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.workoutTitleRow} lightColor="transparent" darkColor="transparent">
          <View style={styles.workoutTitleTextRow} lightColor="transparent" darkColor="transparent">
            <View style={styles.workoutTitleWithIcon} lightColor="transparent" darkColor="transparent">
              <WorkoutIconGlyph iconId={displayIconId} size={22} color="#D40078" />
              <Text style={[styles.workoutTitle, styles.workoutTitleMagenta]} numberOfLines={2}>
                {workout.title}
              </Text>
            </View>
            {session?.intent === 'new' && loadedFromDraft ? (
              <View style={styles.draftTrashRow} lightColor="transparent" darkColor="transparent">
                <Text style={styles.draftBadge}>(Draft)</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear draft and start fresh"
                  onPress={onStartFresh}
                  hitSlop={8}
                  style={({ pressed }) => [styles.draftTrashButton, pressed && styles.checkboxButtonPressed]}>
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>

        <SessionDateTimeField
          value={sessionDate}
          onChange={setSessionDate}
          activeScheme={activeScheme}
          borderColor={borderColor}
          inputBackground={inputBackground}
          textColor={textColor}
        />

        {exercises.map((exercise, exIndex) => (
          <View key={exercise.id} style={[styles.card, { borderColor }]}>
            <View style={styles.cardTitleRow} lightColor="transparent" darkColor="transparent">
              <Text style={styles.cardHeading}>Exercise {exIndex + 1}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${exercise.name} from this log`}
                hitSlop={10}
                onPress={() => confirmRemoveExerciseFromLog(exercise)}
                style={({ pressed }) => [styles.removeExerciseButton, pressed && styles.checkboxButtonPressed]}>
                <Ionicons name="close" size={22} color="#ef4444" />
              </Pressable>
            </View>
            <Text style={[styles.exerciseName, { color: textColor }]}>{exercise.name}</Text>
            <Text style={styles.plannedLine}>Planned: {formatPlannedExerciseSummary(exercise)}</Text>

            {exercise.activityType === 'strength' ? (
              <>
                <View style={styles.actualSetsContainer}>
                  {exercise.actualSets.map((actualSet, setIndex) => (
                    <View key={actualSet.id} style={styles.actualSetRow}>
                      <Text style={[styles.setLabel, { color: textColor }]}>Set {setIndex + 1}</Text>
                      <View style={styles.setRowWithCheckbox}>
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Use planned reps and weight for set ${setIndex + 1}`}
                          accessibilityState={{ checked: hasActualSetValues(actualSet) }}
                          onPress={() => toggleActualSetPlannedValues(exercise.id, actualSet.id)}
                          style={({ pressed }) => [styles.checkboxButton, pressed && styles.checkboxButtonPressed]}
                          hitSlop={8}>
                          <Ionicons
                            name={hasActualSetValues(actualSet) ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={Colors[activeScheme].tint}
                          />
                        </Pressable>
                        <View style={styles.setRow}>
                          <View style={styles.strengthRepsInputWrap}>
                            <TextInput
                              value={actualSet.actualRepsInput}
                              onChangeText={(value) => updateActualSetField(exercise.id, actualSet.id, 'actualRepsInput', value)}
                              placeholder="0"
                              keyboardType="number-pad"
                              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                              style={[
                                styles.input,
                                styles.strengthRepsLogInput,
                                styles.unitInput,
                                { color: textColor, borderColor, backgroundColor: inputBackground },
                              ]}
                            />
                            <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>reps</Text>
                          </View>
                          <View style={styles.strengthWeightWrap}>
                            <TextInput
                              value={actualSet.actualWeightInput}
                              onChangeText={(value) =>
                                updateActualSetField(exercise.id, actualSet.id, 'actualWeightInput', value)
                              }
                              placeholder="Weight"
                              keyboardType="decimal-pad"
                              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                              style={[
                                styles.input,
                                styles.setInput,
                                styles.strengthWeightLogInput,
                                { color: textColor, borderColor, backgroundColor: inputBackground },
                              ]}
                            />
                            <WeightUnitPicker
                              value={exercise.weightUnit}
                              onChange={() => {}}
                              disabled
                              borderColor={borderColor}
                              textColor={textColor}
                            />
                          </View>
                        </View>
                        <Pressable
                          onPress={() => deleteActualSet(exercise.id, actualSet.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete set ${setIndex + 1}`}
                          style={({ pressed }) => [styles.deleteSetButton, pressed && styles.checkboxButtonPressed]}>
                          <Ionicons name="close" size={20} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={() => addActualSet(exercise.id)}
                  style={({ pressed }) => [styles.addSetButton, { borderColor }, pressed && styles.checkboxButtonPressed]}>
                  <Text style={[styles.addSetButtonLabel, { color: textColor }]}>+ Add set</Text>
                </Pressable>
              </>
            ) : null}

            {exercise.activityType === 'cardio' && getCardioLogLayout(exercise) === 'per_segment' ? (
              <View style={styles.actualSetsContainer}>
                <View style={styles.actualSetRow}>
                  <Text style={[styles.setLabel, { color: textColor }]}>
                    {isCardioDurationPerDistance(exercise) ? 'Total distance' : 'Total duration'}
                  </Text>
                  <View style={styles.setRowWithCheckbox}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="Use planned total"
                      accessibilityState={{ checked: hasCardioPerSegmentObjectiveValue(exercise) }}
                      onPress={() => toggleCardioPerSegmentObjectivePlannedValues(exercise.id)}
                      style={({ pressed }) => [styles.checkboxButton, pressed && styles.checkboxButtonPressed]}
                      hitSlop={8}>
                      <Ionicons
                        name={hasCardioPerSegmentObjectiveValue(exercise) ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={Colors[activeScheme].tint}
                      />
                    </Pressable>
                    {isCardioDurationPerDistance(exercise) ? (
                      <View style={[styles.cardioDistanceRow, styles.flexField]}>
                        <TextInput
                          value={exercise.actualDistanceInput}
                          onChangeText={(value) => updateExerciseActualField(exercise.id, 'actualDistanceInput', value)}
                          placeholder="Distance"
                          keyboardType={
                            usesIntegerDistanceInput(exercise.distanceUnit) ? 'number-pad' : 'decimal-pad'
                          }
                          placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                          style={[
                            styles.input,
                            styles.setInput,
                            styles.cardioDistanceInput,
                            { color: textColor, borderColor, backgroundColor: inputBackground },
                          ]}
                        />
                        <CardioDistanceUnitPicker
                          value={exercise.distanceUnit}
                          onChange={() => {}}
                          disabled
                          borderColor={borderColor}
                          textColor={textColor}
                        />
                      </View>
                    ) : (
                      <View style={[styles.cardioDurationRow, styles.flexField]}>
                        <TextInput
                          value={exercise.actualDurationInput}
                          onChangeText={(value) => updateExerciseActualField(exercise.id, 'actualDurationInput', value)}
                          placeholder="Duration"
                          keyboardType={
                            usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'
                          }
                          placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                          style={[
                            styles.input,
                            styles.setInput,
                            styles.cardioDurationInput,
                            { color: textColor, borderColor, backgroundColor: inputBackground },
                          ]}
                        />
                        <DurationUnitPicker
                          value={exercise.durationUnit}
                          onChange={() => {}}
                          disabled
                          borderColor={borderColor}
                          textColor={textColor}
                        />
                      </View>
                    )}
                  </View>
                </View>
                {exercise.actualCardioPerSets.map((actualSet, setIndex) => {
                  const objectiveTotal = resolveCardioPerSegmentObjectiveTotal(
                    exercise,
                    perSegmentObjectiveInputForExercise(exercise),
                  );
                  const segmentLabel = cardioPerSegmentLabel(
                    setIndex,
                    exercise.actualCardioPerSets.length,
                    objectiveTotal,
                    exercise,
                  );
                  const plannedFieldLabel = isCardioDurationPerDistance(exercise) ? 'duration' : 'distance';
                  return (
                    <View key={actualSet.id} style={styles.actualSetRow}>
                      <Text style={[styles.setLabel, { color: textColor }]}>{segmentLabel}</Text>
                      <View style={styles.setRowWithCheckbox}>
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Use planned ${plannedFieldLabel} for ${segmentLabel}`}
                          accessibilityState={{ checked: hasCardioPerActualSetValues(exercise, actualSet) }}
                          onPress={() => toggleCardioPerActualSetPlannedValues(exercise.id, actualSet.id)}
                          style={({ pressed }) => [styles.checkboxButton, pressed && styles.checkboxButtonPressed]}
                          hitSlop={8}>
                          <Ionicons
                            name={hasCardioPerActualSetValues(exercise, actualSet) ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={Colors[activeScheme].tint}
                          />
                        </Pressable>
                        {isCardioDurationPerDistance(exercise) ? (
                          <View style={styles.stretchDurationLogWrap}>
                            <TextInput
                              value={actualSet.actualDurationInput}
                              onChangeText={(value) =>
                                updateCardioPerActualSetField(exercise.id, actualSet.id, 'actualDurationInput', value)
                              }
                              placeholder="Duration"
                              keyboardType={
                                usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'
                              }
                              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                              style={[
                                styles.input,
                                styles.setInput,
                                styles.stretchDurationLogInput,
                                { color: textColor, borderColor, backgroundColor: inputBackground },
                              ]}
                            />
                            <DurationUnitPicker
                              value={exercise.durationUnit}
                              onChange={() => {}}
                              disabled
                              borderColor={borderColor}
                              textColor={textColor}
                            />
                          </View>
                        ) : (
                          <View style={styles.stretchDurationLogWrap}>
                            <TextInput
                              value={actualSet.actualDistanceInput}
                              onChangeText={(value) =>
                                updateCardioPerActualSetField(exercise.id, actualSet.id, 'actualDistanceInput', value)
                              }
                              placeholder="Distance"
                              keyboardType={
                                usesIntegerDistanceInput(exercise.distanceUnit) ? 'number-pad' : 'decimal-pad'
                              }
                              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                              style={[
                                styles.input,
                                styles.setInput,
                                styles.stretchDurationLogInput,
                                { color: textColor, borderColor, backgroundColor: inputBackground },
                              ]}
                            />
                            <CardioDistanceUnitPicker
                              value={exercise.distanceUnit}
                              onChange={() => {}}
                              disabled
                              borderColor={borderColor}
                              textColor={textColor}
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {exercise.activityType === 'cardio' && getCardioLogLayout(exercise) === 'total' ? (
              <View style={styles.actualSetRow}>
                <View style={styles.setRowWithCheckbox}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="Use planned duration and distance"
                    accessibilityState={{ checked: hasCardioTotalActualValues(exercise) }}
                    onPress={() => toggleCardioTotalPlannedValues(exercise.id)}
                    style={({ pressed }) => [styles.checkboxButton, pressed && styles.checkboxButtonPressed]}
                    hitSlop={8}>
                    <Ionicons
                      name={hasCardioTotalActualValues(exercise) ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={Colors[activeScheme].tint}
                    />
                  </Pressable>
                  <View style={[styles.cardioFieldsColumn, styles.flexField]}>
                    {normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' }).cardioObjective ===
                    'distance' ? (
                      <>
                        <View style={styles.cardioDistanceRow}>
                          <TextInput
                            value={exercise.actualDistanceInput}
                            onChangeText={(value) =>
                              updateExerciseActualField(exercise.id, 'actualDistanceInput', value)
                            }
                            placeholder="Distance"
                            keyboardType={
                              usesIntegerDistanceInput(exercise.distanceUnit) ? 'number-pad' : 'decimal-pad'
                            }
                            placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                            style={[
                              styles.input,
                              styles.setInput,
                              styles.cardioDistanceInput,
                              { color: textColor, borderColor, backgroundColor: inputBackground },
                            ]}
                          />
                          <CardioDistanceUnitPicker
                            value={exercise.distanceUnit}
                            onChange={() => {}}
                            disabled
                            borderColor={borderColor}
                            textColor={textColor}
                          />
                        </View>
                        <View style={styles.cardioDurationRow}>
                          <TextInput
                            value={exercise.actualDurationInput}
                            onChangeText={(value) =>
                              updateExerciseActualField(exercise.id, 'actualDurationInput', value)
                            }
                            placeholder="Duration"
                            keyboardType={
                              usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'
                            }
                            placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                            style={[
                              styles.input,
                              styles.setInput,
                              styles.cardioDurationInput,
                              { color: textColor, borderColor, backgroundColor: inputBackground },
                            ]}
                          />
                          <DurationUnitPicker
                            value={exercise.durationUnit}
                            onChange={() => {}}
                            disabled
                            borderColor={borderColor}
                            textColor={textColor}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.cardioDurationRow}>
                          <TextInput
                            value={exercise.actualDurationInput}
                            onChangeText={(value) =>
                              updateExerciseActualField(exercise.id, 'actualDurationInput', value)
                            }
                            placeholder="Duration"
                            keyboardType={
                              usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'
                            }
                            placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                            style={[
                              styles.input,
                              styles.setInput,
                              styles.cardioDurationInput,
                              { color: textColor, borderColor, backgroundColor: inputBackground },
                            ]}
                          />
                          <DurationUnitPicker
                            value={exercise.durationUnit}
                            onChange={() => {}}
                            disabled
                            borderColor={borderColor}
                            textColor={textColor}
                          />
                        </View>
                        <View style={styles.cardioDistanceRow}>
                          <TextInput
                            value={exercise.actualDistanceInput}
                            onChangeText={(value) =>
                              updateExerciseActualField(exercise.id, 'actualDistanceInput', value)
                            }
                            placeholder="Distance"
                            keyboardType={
                              usesIntegerDistanceInput(exercise.distanceUnit) ? 'number-pad' : 'decimal-pad'
                            }
                            placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                            style={[
                              styles.input,
                              styles.setInput,
                              styles.cardioDistanceInput,
                              { color: textColor, borderColor, backgroundColor: inputBackground },
                            ]}
                          />
                          <CardioDistanceUnitPicker
                            value={exercise.distanceUnit}
                            onChange={() => {}}
                            disabled
                            borderColor={borderColor}
                            textColor={textColor}
                          />
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>
            ) : null}

            {exercise.activityType === 'cardio' && getCardioLogLayout(exercise) === 'objective_only' ? (
              <View style={styles.actualSetRow}>
                <View style={styles.setRowWithCheckbox}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="Use planned value"
                    accessibilityState={{ checked: hasCardioObjectiveOnlyActualValues(exercise) }}
                    onPress={() => toggleCardioObjectiveOnlyPlannedValues(exercise.id)}
                    style={({ pressed }) => [styles.checkboxButton, pressed && styles.checkboxButtonPressed]}
                    hitSlop={8}>
                    <Ionicons
                      name={hasCardioObjectiveOnlyActualValues(exercise) ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={Colors[activeScheme].tint}
                    />
                  </Pressable>
                  {normalizeCardioPlanFields({ ...exercise, activityType: 'cardio' }).cardioObjective ===
                  'distance' ? (
                    <View style={[styles.cardioDistanceRow, styles.flexField]}>
                      <TextInput
                        value={exercise.actualDistanceInput}
                        onChangeText={(value) => updateExerciseActualField(exercise.id, 'actualDistanceInput', value)}
                        placeholder="Distance"
                        keyboardType={
                          usesIntegerDistanceInput(exercise.distanceUnit) ? 'number-pad' : 'decimal-pad'
                        }
                        placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                        style={[
                          styles.input,
                          styles.setInput,
                          styles.cardioDistanceInput,
                          { color: textColor, borderColor, backgroundColor: inputBackground },
                        ]}
                      />
                      <CardioDistanceUnitPicker
                        value={exercise.distanceUnit}
                        onChange={() => {}}
                        disabled
                        borderColor={borderColor}
                        textColor={textColor}
                      />
                    </View>
                  ) : (
                    <View style={[styles.cardioDurationRow, styles.flexField]}>
                      <TextInput
                        value={exercise.actualDurationInput}
                        onChangeText={(value) => updateExerciseActualField(exercise.id, 'actualDurationInput', value)}
                        placeholder="Duration"
                        keyboardType={usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'}
                        placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                        style={[
                          styles.input,
                          styles.setInput,
                          styles.cardioDurationInput,
                          { color: textColor, borderColor, backgroundColor: inputBackground },
                        ]}
                      />
                      <DurationUnitPicker
                        value={exercise.durationUnit}
                        onChange={() => {}}
                        disabled
                        borderColor={borderColor}
                        textColor={textColor}
                      />
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {exercise.activityType === 'sport' ? (
              <View style={styles.setRowWithCheckbox}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Use planned duration and score"
                  accessibilityState={{ checked: hasSportActualValues(exercise) }}
                  onPress={() => toggleSportPlannedValues(exercise.id)}
                  style={({ pressed }) => [styles.checkboxButton, pressed && styles.checkboxButtonPressed]}
                  hitSlop={8}>
                  <Ionicons
                    name={hasSportActualValues(exercise) ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={Colors[activeScheme].tint}
                  />
                </Pressable>
                <View style={[styles.cardioFieldsColumn, styles.flexField]}>
                  <View style={styles.cardioDurationRow}>
                    <TextInput
                      value={exercise.actualDurationInput}
                      onChangeText={(value) => updateExerciseActualField(exercise.id, 'actualDurationInput', value)}
                      placeholder="Duration"
                      keyboardType={usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'}
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      style={[
                        styles.input,
                        styles.setInput,
                        styles.cardioDurationInput,
                        { color: textColor, borderColor, backgroundColor: inputBackground },
                      ]}
                    />
                    <DurationUnitPicker
                      value={exercise.durationUnit}
                      onChange={() => {}}
                      disabled
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                  </View>
                  <View style={styles.sportScoreRow}>
                    <TextInput
                      value={exercise.actualScoreInput}
                      onChangeText={(value) => updateExerciseActualField(exercise.id, 'actualScoreInput', value)}
                      placeholder="Score"
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      style={[
                        styles.input,
                        styles.setInput,
                        styles.sportScoreInput,
                        { color: textColor, borderColor, backgroundColor: inputBackground },
                      ]}
                    />
                    <ScoreUnitPicker
                      value={exercise.scoreUnit}
                      onChange={() => {}}
                      disabled
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                  </View>
                </View>
              </View>
            ) : null}

            {exercise.activityType === 'stretch' ? (
              <>
                <View style={styles.actualSetsContainer}>
                  {exercise.actualStretchSets.map((actualSet, setIndex) => (
                    <View key={actualSet.id} style={styles.actualSetRow}>
                      <Text style={[styles.setLabel, { color: textColor }]}>Set {setIndex + 1}</Text>
                      <View style={styles.setRowWithCheckbox}>
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={`Use planned duration for set ${setIndex + 1}`}
                          accessibilityState={{ checked: hasStretchActualSetValues(actualSet) }}
                          onPress={() => toggleStretchActualSetPlannedValues(exercise.id, actualSet.id)}
                          style={({ pressed }) => [styles.checkboxButton, pressed && styles.checkboxButtonPressed]}
                          hitSlop={8}>
                          <Ionicons
                            name={hasStretchActualSetValues(actualSet) ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={Colors[activeScheme].tint}
                          />
                        </Pressable>
                        <View style={styles.stretchDurationLogWrap}>
                          <TextInput
                            value={actualSet.actualDurationInput}
                            onChangeText={(value) => updateStretchActualSetField(exercise.id, actualSet.id, value)}
                            placeholder="Duration"
                            keyboardType={
                              usesIntegerDurationInput(plannedStretchDurationUnitForSet(exercise, setIndex))
                                ? 'number-pad'
                                : 'decimal-pad'
                            }
                            placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                            style={[
                              styles.input,
                              styles.setInput,
                              styles.stretchDurationLogInput,
                              { color: textColor, borderColor, backgroundColor: inputBackground },
                            ]}
                          />
                          <DurationUnitPicker
                            value={plannedStretchDurationUnitForSet(exercise, setIndex)}
                            onChange={() => {}}
                            disabled
                            borderColor={borderColor}
                            textColor={textColor}
                          />
                        </View>
                        <Pressable
                          onPress={() => deleteStretchActualSet(exercise.id, actualSet.id)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete set ${setIndex + 1}`}
                          style={({ pressed }) => [styles.deleteSetButton, pressed && styles.checkboxButtonPressed]}>
                          <Ionicons name="close" size={20} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
                <Pressable
                  onPress={() => addStretchActualSet(exercise.id)}
                  style={({ pressed }) => [styles.addSetButton, { borderColor }, pressed && styles.checkboxButtonPressed]}>
                  <Text style={[styles.addSetButtonLabel, { color: textColor }]}>+ Add set</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ))}
        </ScrollView>
        <StickySaveFooter onPress={onSave} activeScheme={activeScheme} />
      </KeyboardAvoidingView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 16,
    gap: 14,
  },
  fieldColumn: {
    gap: 10,
  },
  scoreInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  durationInputWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  cardioFieldsColumn: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  cardioDurationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  cardioDurationInput: {
    flex: 1,
    minWidth: 0,
  },
  flexField: {
    flex: 1,
    minWidth: 0,
  },
  cardioDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  cardioDistanceInput: {
    flex: 1,
    minWidth: 0,
  },
  sportScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  sportScoreInput: {
    flex: 1,
    minWidth: 0,
  },
  workoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  workoutTitleMagenta: {
    color: '#D40078',
  },
  workoutTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workoutTitleTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    minWidth: 0,
  },
  draftTrashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  draftTrashButton: {
    padding: 2,
  },
  draftBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D40078',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    flexShrink: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  removeExerciseButton: {
    padding: 2,
    flexShrink: 0,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  setInput: {
    flex: 1,
    minWidth: 0,
  },
  strengthRepsInputWrap: {
    flexGrow: 0,
    flexShrink: 0,
    width: 96,
    minWidth: 96,
    maxWidth: 96,
    position: 'relative',
  },
  strengthRepsLogInput: {
    width: '100%',
  },
  strengthWeightWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  strengthWeightLogInput: {
    flex: 1,
    minWidth: 0,
  },
  stretchLogRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stretchSetsInputWrap: {
    flexGrow: 0,
    flexShrink: 0,
    width: 108,
    minWidth: 108,
    maxWidth: 108,
    position: 'relative',
  },
  stretchDurationLogWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stretchDurationLogInput: {
    flex: 1,
    minWidth: 0,
  },
  unitInputWrap: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  unitInput: {
    paddingRight: 34,
  },
  unitSuffix: {
    position: 'absolute',
    right: 12,
    top: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  actualSetsContainer: {
    gap: 8,
  },
  actualSetRow: {
    gap: 8,
  },
  setRowWithCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  checkboxButton: {
    padding: 2,
  },
  deleteSetButton: {
    padding: 2,
  },
  checkboxButtonPressed: {
    opacity: 0.65,
  },
  addSetButton: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addSetButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  plannedLine: {
    fontSize: 14,
    opacity: 0.8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
