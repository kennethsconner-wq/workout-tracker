import { useNavigation, useFocusEffect, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { DraftExerciseDraggableList } from '@/components/DraftExerciseDraggableList';
import { StickySaveFooter } from '@/components/StickySaveFooter';
import { WorkoutFormExerciseLibraryMenu } from '@/components/WorkoutFormExerciseLibraryMenu';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import { DEFAULT_DURATION_UNIT, DEFAULT_STRETCH_DURATION_UNIT, normalizeCardioDurationUnit, normalizeSportDurationUnit, type DurationUnit } from '@/lib/durationUnits';
import { DEFAULT_CARDIO_DISTANCE_MODE, type CardioDistanceMode } from '@/lib/cardioDistanceMode';
import type { ScoreUnit } from '@/lib/scoreUnits';
import type { WeightUnit } from '@/lib/weightUnits';
import {
  emptyExerciseDraftRow,
  exerciseDraftRowFromSeed,
  exerciseDraftSeedFromRow,
  isExerciseDraftRowEmpty,
  parseWorkoutExerciseFromDraft,
  sanitizeExerciseDraftRow,
  workoutExerciseToDraftRow,
  type ExerciseDraftRow,
  type ExerciseDraftSeed,
} from '@/lib/exerciseDraft';
import { newId } from '@/lib/ids';
import { WorkoutIconPicker } from '@/components/WorkoutIconPicker';
import { WorkoutDaysPicker } from '@/components/WorkoutDaysPicker';
import { DEFAULT_WORKOUT_ICON_ID, normalizeWorkoutIconId, type WorkoutIconId } from '@/lib/workoutIcons';
import { DAYS_OF_WEEK, type DayOfWeek, type Workout, type WorkoutExercise } from '@/lib/types';
import { themedAlert } from '@/lib/themedAlert';
import { addWorkout, findTemplateExerciseById, loadWorkouts, propagateExerciseDefinitionsAcrossWorkouts } from '@/lib/workoutsStorage';

type CopyWorkoutPayload = Pick<Workout, 'title' | 'daysOfWeek' | 'iconId'> & {
  exercises: Array<
    Pick<
      WorkoutExercise,
      'id' | 'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'score' | 'scoreUnit'
    >
  >;
};
type ImportExercisesPayload = {
  nonce: string;
  exercises: ExerciseDraftSeed[];
  /** Preserves Create Workout form when returning from Exercise Library (screen remounts). */
  createDraft?: { title: string; daysOfWeek: DayOfWeek[]; iconId: WorkoutIconId };
};

function isDayOfWeekString(value: string): value is DayOfWeek {
  return (DAYS_OF_WEEK as readonly string[]).includes(value);
}

export default function LogWorkoutScreen() {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ copyWorkout?: string | string[]; importExercises?: string | string[] }>();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';

  const [title, setTitle] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>([]);
  const [iconId, setIconId] = useState<WorkoutIconId>(DEFAULT_WORKOUT_ICON_ID);
  const [exercises, setExercises] = useState<ExerciseDraftRow[]>([]);
  /** `clientId`s for linked exercises (`sourceExerciseId`) the user chose to edit after confirmation. */
  const [unlockedExerciseClientIds, setUnlockedExerciseClientIds] = useState(() => new Set<string>());
  const lastAppliedCopyPayloadRef = useRef<string | null>(null);
  const lastAppliedImportExercisesRef = useRef<string | null>(null);

  const resetCreateWorkoutForm = useCallback(() => {
    setTitle('');
    setDaysOfWeek([]);
    setIconId(DEFAULT_WORKOUT_ICON_ID);
    setExercises([]);
    setUnlockedExerciseClientIds(new Set());
    lastAppliedCopyPayloadRef.current = null;
    lastAppliedImportExercisesRef.current = null;
    router.setParams({ copyWorkout: undefined, importExercises: undefined });
  }, []);

  /** Only when switching bottom tabs away from Create — not when pushing Exercise Library (stack on root). */
  useEffect(() => {
    const tabNav = navigation.getParent();
    if (!tabNav) {
      return;
    }

    const activeTabRouteName = (): string | null => {
      const state = tabNav.getState();
      if (!state || typeof state.index !== 'number' || !Array.isArray(state.routes)) {
        return null;
      }
      const route = state.routes[state.index];
      return route && typeof route.name === 'string' ? route.name : null;
    };

    let previous = activeTabRouteName();

    const unsub = tabNav.addListener('state', () => {
      const current = activeTabRouteName();
      if (previous === 'workouts' && current !== 'workouts') {
        resetCreateWorkoutForm();
      }
      previous = current;
    });

    return unsub;
  }, [navigation, resetCreateWorkoutForm]);

  const inputStyle = [styles.input, { color: textColor, borderColor, backgroundColor: inputBackground }];
  const workoutNameInputStyle = [styles.input, { color: '#D40078', borderColor, backgroundColor: inputBackground }];
  const setRowInputStyle = useMemo(
    () => [
      styles.input,
      styles.setInput,
      styles.unitInput,
      { color: textColor, borderColor, backgroundColor: inputBackground },
    ],
    [textColor, borderColor, inputBackground],
  );

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExerciseDraftRow()]);
  };
  const removeExercise = (exerciseId: string) => {
    setUnlockedExerciseClientIds((prev) => {
      const next = new Set(prev);
      next.delete(exerciseId);
      return next;
    });
    setExercises((prev) => prev.filter((ex) => ex.clientId !== exerciseId));
  };
  const updateExerciseName = (exerciseId: string, name: string) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, name } : ex)));
  };

  const updateExerciseActivityType = (exerciseId: string, activityType: ActivityType) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.clientId !== exerciseId) {
          return ex;
        }
        const next = sanitizeExerciseDraftRow({ ...ex, activityType });
        if (activityType === 'stretch') {
          return { ...next, durationUnit: DEFAULT_STRETCH_DURATION_UNIT };
        }
        if (activityType === 'cardio') {
          const durationUnit =
            next.durationUnit === 'breaths' ? DEFAULT_DURATION_UNIT : normalizeCardioDurationUnit(next.durationUnit);
          return { ...next, cardioDistanceMode: DEFAULT_CARDIO_DISTANCE_MODE, durationUnit };
        }
        if (activityType === 'sport') {
          return { ...next, durationUnit: normalizeSportDurationUnit(next.durationUnit) };
        }
        return next;
      }),
    );
  };

  const updateExerciseField = (
    exerciseId: string,
    field: 'sets' | 'reps' | 'weight' | 'duration' | 'distance' | 'score',
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, [field]: value } : ex)),
    );
  };

  const updateExerciseDistanceUnit = (exerciseId: string, unit: CardioDistanceUnit) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, distanceUnit: unit } : ex)),
    );
  };

  const updateExerciseCardioDistanceMode = (exerciseId: string, mode: CardioDistanceMode) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, cardioDistanceMode: mode } : ex)),
    );
  };

  const updateExerciseDurationUnit = (exerciseId: string, unit: DurationUnit) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, durationUnit: unit } : ex)),
    );
  };

  const updateExerciseScoreUnit = (exerciseId: string, unit: ScoreUnit) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, scoreUnit: unit } : ex)),
    );
  };

  const updateExerciseWeightUnit = (exerciseId: string, unit: WeightUnit) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, weightUnit: unit } : ex)),
    );
  };

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const all = await loadWorkouts();
        if (cancelled) {
          return;
        }
        setExercises((prev) => {
          if (!prev.some((e) => e.sourceExerciseId)) {
            return prev;
          }
          const next: ExerciseDraftRow[] = [];
          for (const ex of prev) {
            const templateId = ex.sourceExerciseId;
            if (!templateId) {
              next.push(ex);
              continue;
            }
            const latest = findTemplateExerciseById(all, templateId);
            if (!latest) {
              continue;
            }
            next.push(workoutExerciseToDraftRow(latest, { clientId: ex.clientId, sourceExerciseId: templateId }));
          }
          const allowed = new Set(next.map((e) => e.clientId));
          setUnlockedExerciseClientIds((ids) => new Set([...ids].filter((cid) => allowed.has(cid))));
          return next;
        });
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  useEffect(() => {
    const raw = Array.isArray(params.copyWorkout) ? params.copyWorkout[0] : params.copyWorkout;
    if (!raw || raw === lastAppliedCopyPayloadRef.current) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as CopyWorkoutPayload;
      if (!parsed.title || !parsed.iconId || !Array.isArray(parsed.exercises) || !Array.isArray(parsed.daysOfWeek)) {
        return;
      }

      setTitle(parsed.title);
      setDaysOfWeek(parsed.daysOfWeek);
      setIconId(parsed.iconId);

      const mappedDrafts = parsed.exercises.map((ex) =>
        workoutExerciseToDraftRow(ex, { sourceExerciseId: ex.id }),
      );
      setExercises(mappedDrafts);
      setUnlockedExerciseClientIds(new Set());

      lastAppliedCopyPayloadRef.current = raw;
    } catch {
      // Ignore malformed deep-link data and keep the current draft.
    }
  }, [params.copyWorkout]);

  useEffect(() => {
    const raw = Array.isArray(params.importExercises) ? params.importExercises[0] : params.importExercises;
    if (!raw || raw === lastAppliedImportExercisesRef.current) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as ImportExercisesPayload;
      if (!Array.isArray(parsed.exercises)) {
        return;
      }
      if (parsed.createDraft) {
        setTitle(typeof parsed.createDraft.title === 'string' ? parsed.createDraft.title : '');
        const restoredDays = Array.isArray(parsed.createDraft.daysOfWeek)
          ? parsed.createDraft.daysOfWeek.filter((day): day is DayOfWeek => typeof day === 'string' && isDayOfWeekString(day))
          : [];
        setDaysOfWeek(restoredDays);
        setIconId(normalizeWorkoutIconId(parsed.createDraft.iconId));
      }
      setExercises(parsed.exercises.map((exercise) => exerciseDraftRowFromSeed(exercise)));
      setUnlockedExerciseClientIds(new Set());
      lastAppliedImportExercisesRef.current = raw;
    } catch {
      // Ignore malformed deep-link data and keep the current draft.
    }
  }, [params.importExercises]);

  const parseWorkout = (): Omit<Workout, 'id' | 'createdAt'> | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      themedAlert('Missing title', 'Give this session a short name (for example, “Upper body”).');
      return null;
    }
    if (daysOfWeek.length === 0) {
      themedAlert('Choose at least one day', 'Select one or more days of the week for this workout.');
      return null;
    }

    const parsedExercises: WorkoutExercise[] = [];

    for (const ex of exercises) {
      if (isExerciseDraftRowEmpty(ex)) {
        continue;
      }
      const result = parseWorkoutExerciseFromDraft(ex, ex.sourceExerciseId ?? newId());
      if (!result.ok) {
        if (result.title) {
          themedAlert(result.title, result.message);
        }
        return null;
      }
      parsedExercises.push(result.exercise);
    }

    if (parsedExercises.length === 0) {
      themedAlert('Add an exercise', 'Enter at least one exercise name and one complete set.');
      return null;
    }

    return { title: trimmedTitle, daysOfWeek, iconId, exercises: parsedExercises };
  };

  const onSave = () => {
    const parsed = parseWorkout();
    if (!parsed) {
      return;
    }

    void (async () => {
      await addWorkout({
        title: parsed.title,
        daysOfWeek: parsed.daysOfWeek,
        iconId: parsed.iconId,
        exercises: parsed.exercises,
      });
      await propagateExerciseDefinitionsAcrossWorkouts(parsed.exercises);
      resetCreateWorkoutForm();
      router.replace('/');
    })();
  };

  const openExerciseLibraryFromMenu = useCallback(() => {
    router.push({
      pathname: '/exercise-library',
      params: {
        libraryEntry: 'menu',
        source: 'create',
        createDraft: JSON.stringify({ title, daysOfWeek, iconId }),
        existingExercises: JSON.stringify(exercises.map((exercise) => exerciseDraftSeedFromRow(exercise))),
      },
    });
  }, [title, daysOfWeek, iconId, exercises]);

  return (
    <RNView style={styles.screenWrap}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.select({ ios: 'padding', android: 'height' })}
        keyboardVerticalOffset={Platform.select({ ios: 80, android: 24 })}>
        <DraftExerciseDraggableList
        exercises={exercises}
        onReorder={setExercises}
        activeScheme={activeScheme}
        borderColor={borderColor}
        textColor={textColor}
        exerciseNameInputStyle={inputStyle}
        setRowInputStyle={setRowInputStyle}
        unlockedExerciseClientIds={unlockedExerciseClientIds}
        onUnlockLinked={(clientId) =>
          setUnlockedExerciseClientIds((prev) => new Set(prev).add(clientId))
        }
        onUpdateExerciseName={updateExerciseName}
        onUpdateExerciseActivityType={updateExerciseActivityType}
        onUpdateExerciseField={updateExerciseField}
        onUpdateExerciseDistanceUnit={updateExerciseDistanceUnit}
        onUpdateExerciseCardioDistanceMode={updateExerciseCardioDistanceMode}
        onUpdateExerciseDurationUnit={updateExerciseDurationUnit}
        onUpdateExerciseScoreUnit={updateExerciseScoreUnit}
        onUpdateExerciseWeightUnit={updateExerciseWeightUnit}
        onRemoveExercise={removeExercise}
        contentContainerStyle={styles.scroll}
        listHeader={
          <>
            <Text style={styles.label}>Workout name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Push day"
              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
              style={workoutNameInputStyle}
            />
            <WorkoutDaysPicker value={daysOfWeek} onChange={setDaysOfWeek} />
            <WorkoutIconPicker value={iconId} onChange={setIconId} />
          </>
        }
        listFooter={
          <>
            <View style={styles.exerciseActionsRow}>
              <Pressable onPress={addExercise} style={styles.secondaryButton}>
                <Text style={[styles.secondaryButtonLabel, { color: Colors[activeScheme].tint }]}>
                  Create Exercise
                </Text>
              </Pressable>
              <Text style={styles.orLabel}>or</Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/exercise-library',
                    params: {
                      source: 'create',
                      createDraft: JSON.stringify({ title, daysOfWeek, iconId }),
                      existingExercises: JSON.stringify(exercises.map((exercise) => exerciseDraftSeedFromRow(exercise))),
                    },
                  })
                }
                style={styles.secondaryButton}>
                <Text style={[styles.secondaryButtonLabel, { color: Colors[activeScheme].tint }]}>
                  Add Existing
                </Text>
              </Pressable>
            </View>
          </>
        }
      />
        <StickySaveFooter onPress={onSave} activeScheme={activeScheme} insetBottom={false} />
      </KeyboardAvoidingView>
      <WorkoutFormExerciseLibraryMenu
        navigation={navigation as NavigationProp<ParamListBase>}
        activeScheme={activeScheme}
        onExerciseLibrary={openExerciseLibraryFromMenu}
      />
    </RNView>
  );
}

const styles = StyleSheet.create({
  screenWrap: {
    flex: 1,
    position: 'relative',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 16,
    gap: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  setInput: {
    flexGrow: 1,
    minWidth: 80,
  },
  unitInput: {
    paddingRight: 34,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  exerciseActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  orLabel: {
    fontSize: 15,
    opacity: 0.7,
    fontWeight: '600',
  },
  secondaryButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
