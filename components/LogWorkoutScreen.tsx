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
import type { LoggedWorkout, LoggedWorkoutExercise, Workout } from '@/lib/types';
import { clearNewLogDraft, isNewLogFormPristine, newLogDraftStorageKey } from '@/lib/logWorkoutDraft';
import { DEFAULT_WORKOUT_ICON_ID, type WorkoutIconId } from '@/lib/workoutIcons';
import { addLoggedWorkout, loadLoggedWorkouts, loadWorkouts, updateLoggedWorkout } from '@/lib/workoutsStorage';

type DraftActualSet = {
  id: string;
  actualRepsInput: string;
  actualWeightKgInput: string;
};

type DraftExercise = Omit<LoggedWorkoutExercise, 'actualSets'> & {
  actualSets: DraftActualSet[];
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
  return actualSet.actualRepsInput.trim().length > 0 && actualSet.actualWeightKgInput.trim().length > 0;
}

function draftStorageKey(workoutId: string): string {
  return `workout-log-draft@v1:${workoutId}`;
}

/** Legacy key — cleared when opening a saved log for edit (edit sessions no longer use drafts). */
function legacyEditDraftStorageKey(loggedWorkoutId: string): string {
  return `workout-log-draft-edit@v1:${loggedWorkoutId}`;
}

function loggedActualToDraftSet(as: LoggedWorkoutExercise['actualSets'][number]): DraftActualSet {
  return {
    id: newId(),
    actualRepsInput: String(as.actualReps),
    actualWeightKgInput: String(as.actualWeightKg),
  };
}

function emptyDraftForTemplateExercise(exercise: Workout['exercises'][number]): DraftExercise {
  return {
    id: newId(),
    workoutExerciseId: exercise.id,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weightKg: exercise.weightKg,
    actualSets: Array.from({ length: exercise.sets }, () => ({
      id: newId(),
      actualRepsInput: '',
      actualWeightKgInput: '',
    })),
  };
}

/** Hydrate the log form from a saved session plus the current template (new template exercises get empty actuals). */
function buildDraftExercisesFromLogged(logged: LoggedWorkout, template: Workout): DraftExercise[] {
  const loggedByWorkoutExerciseId = new Map(logged.exercises.map((e) => [e.workoutExerciseId, e]));
  const templateIds = new Set(template.exercises.map((e) => e.id));
  const out: DraftExercise[] = [];

  for (const te of template.exercises) {
    const le = loggedByWorkoutExerciseId.get(te.id);
    if (le) {
      out.push({
        id: le.id,
        workoutExerciseId: le.workoutExerciseId,
        name: le.name,
        sets: le.sets,
        reps: le.reps,
        weightKg: le.weightKg,
        actualSets: le.actualSets.map((as) => loggedActualToDraftSet(as)),
      });
    } else {
      out.push(emptyDraftForTemplateExercise(te));
    }
  }

  for (const le of logged.exercises) {
    if (!templateIds.has(le.workoutExerciseId)) {
      out.push({
        id: le.id,
        workoutExerciseId: le.workoutExerciseId,
        name: le.name,
        sets: le.sets,
        reps: le.reps,
        weightKg: le.weightKg,
        actualSets: le.actualSets.map((as) => loggedActualToDraftSet(as)),
      });
    }
  }

  return out;
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
      typeof o.weightKg !== 'number'
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
        actualWeightKgInput: typeof so.actualWeightKgInput === 'string' ? so.actualWeightKgInput : '',
      });
    }
    out.push({
      id: o.id,
      workoutExerciseId: o.workoutExerciseId,
      name: o.name,
      sets: o.sets,
      reps: o.reps,
      weightKg: o.weightKg,
      actualSets,
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
  const byWorkoutExerciseId = new Map(
    savedList
      .filter((exercise): exercise is DraftExercise => !!exercise && typeof exercise.workoutExerciseId === 'string')
      .map((exercise) => [exercise.workoutExerciseId, exercise]),
  );
  return workout.exercises
    .filter((exercise) => !omit.has(exercise.id))
    .map((exercise) => {
      const saved = byWorkoutExerciseId.get(exercise.id);
      const savedLen = saved?.actualSets?.length ?? 0;
      const setCount = Math.max(exercise.sets, savedLen);
      return {
        id: saved?.id && typeof saved.id === 'string' ? saved.id : newId(),
        workoutExerciseId: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        weightKg: exercise.weightKg,
        actualSets: Array.from({ length: setCount }, (_, setIndex) => {
          const savedSet = saved?.actualSets?.[setIndex];
          return {
            id: savedSet?.id && typeof savedSet.id === 'string' ? savedSet.id : newId(),
            actualRepsInput: typeof savedSet?.actualRepsInput === 'string' ? savedSet.actualRepsInput : '',
            actualWeightKgInput: typeof savedSet?.actualWeightKgInput === 'string' ? savedSet.actualWeightKgInput : '',
          };
        }),
      };
    });
}

function toDraftExercises(workout: Workout): DraftExercise[] {
  return workout.exercises.map((exercise) => ({
    id: newId(),
    workoutExerciseId: exercise.id,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weightKg: exercise.weightKg,
    actualSets: Array.from({ length: exercise.sets }, () => ({
      id: newId(),
      actualRepsInput: '',
      actualWeightKgInput: '',
    })),
  }));
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
    field: keyof Pick<DraftActualSet, 'actualRepsInput' | 'actualWeightKgInput'>,
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
        return {
          ...ex,
          actualSets: ex.actualSets.map((actualSet) => {
            if (actualSet.id !== actualSetId) {
              return actualSet;
            }
            const isChecked = hasActualSetValues(actualSet);
            if (isChecked) {
              return { ...actualSet, actualRepsInput: '', actualWeightKgInput: '' };
            }
            const plannedReps = String(ex.reps);
            const plannedWeight = String(ex.weightKg);
            return { ...actualSet, actualRepsInput: plannedReps, actualWeightKgInput: plannedWeight };
          }),
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
              actualWeightKgInput: '',
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

  const parseWorkout = (): { workout: Workout; exercises: LoggedWorkoutExercise[] } | null => {
    if (!workout) {
      return null;
    }

    const parsedExercises: LoggedWorkoutExercise[] = [];

    for (const ex of exercises) {
      const parsedActualSets: LoggedWorkoutExercise['actualSets'] = [];
      for (let setIndex = 0; setIndex < ex.actualSets.length; setIndex++) {
        const actualSet = ex.actualSets[setIndex];
        const actualReps = Number.parseInt(actualSet.actualRepsInput.trim(), 10);
        const actualWeightKg = Number.parseFloat(actualSet.actualWeightKgInput.trim().replace(',', '.'));

        if (!Number.isFinite(actualReps) || actualReps <= 0) {
          themedAlert('Check your numbers', `Enter positive reps for set ${setIndex + 1} of "${ex.name}".`);
          return null;
        }
        if (!Number.isFinite(actualWeightKg) || actualWeightKg < 0) {
          themedAlert(
            'Check your numbers',
            `Enter a valid weight (0 for bodyweight) for set ${setIndex + 1} of "${ex.name}".`,
          );
          return null;
        }

        parsedActualSets.push({
          actualReps,
          actualWeightKg,
        });
      }

      parsedExercises.push({
        id: ex.id,
        workoutExerciseId: ex.workoutExerciseId,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weightKg: ex.weightKg,
        actualSets: parsedActualSets,
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
            <Text style={styles.plannedLine}>
              Planned: {exercise.sets} set{exercise.sets === 1 ? '' : 's'} x {exercise.reps} reps @ {exercise.weightKg} lb
            </Text>
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
                      <View style={styles.unitInputWrap}>
                        <TextInput
                          value={actualSet.actualRepsInput}
                          onChangeText={(value) => updateActualSetField(exercise.id, actualSet.id, 'actualRepsInput', value)}
                          placeholder="0"
                          keyboardType="number-pad"
                          placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                          style={[
                            styles.input,
                            styles.setInput,
                            styles.unitInput,
                            { color: textColor, borderColor, backgroundColor: inputBackground },
                          ]}
                        />
                        <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>reps</Text>
                      </View>
                      <View style={styles.unitInputWrap}>
                        <TextInput
                          value={actualSet.actualWeightKgInput}
                          onChangeText={(value) =>
                            updateActualSetField(exercise.id, actualSet.id, 'actualWeightKgInput', value)
                          }
                          placeholder="Weight"
                          keyboardType="decimal-pad"
                          placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                          style={[
                            styles.input,
                            styles.setInput,
                            styles.unitInput,
                            { color: textColor, borderColor, backgroundColor: inputBackground },
                          ]}
                        />
                        <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>lb</Text>
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
