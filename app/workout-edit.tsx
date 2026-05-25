import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useNavigation, useFocusEffect, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import type { DurationUnit } from '@/lib/durationUnits';
import {
  type CardioDistanceTracking,
  type CardioDurationTracking,
  type CardioObjective,
} from '@/lib/cardioPlan';
import type { ScoreUnit } from '@/lib/scoreUnits';
import type { WeightUnit } from '@/lib/weightUnits';
import {
  emptyExerciseDraftRow,
  exerciseDraftRowFromSeed,
  exerciseDraftSeedFromRow,
  isExerciseDraftRowEmpty,
  parseWorkoutExerciseFromDraft,
  applyActivityTypeChangeToDraftRow,
  applyCardioObjectiveChangeToDraftRow,
  applyCardioDurationTrackingChangeToDraftRow,
  applyCardioDistanceTrackingChangeToDraftRow,
  workoutExerciseToDraftRow,
  type ExerciseDraftRow,
  type ExerciseDraftSeed,
} from '@/lib/exerciseDraft';
import { newId } from '@/lib/ids';
import { validateExerciseNamesForWorkoutSave } from '@/lib/exerciseNameValidation';
import { WorkoutIconPicker } from '@/components/WorkoutIconPicker';
import { WorkoutDaysPicker } from '@/components/WorkoutDaysPicker';
import { DEFAULT_WORKOUT_ICON_ID, type WorkoutIconId } from '@/lib/workoutIcons';
import { type DayOfWeek, type Workout, type WorkoutExercise } from '@/lib/types';
import { themedAlert } from '@/lib/themedAlert';
import { loadWorkouts, propagateExerciseDefinitionsAcrossWorkouts, updateWorkout } from '@/lib/workoutsStorage';

type ImportExercisesPayload = { nonce: string; exercises: ExerciseDraftSeed[] };

function toDraft(exercise: WorkoutExercise): ExerciseDraftRow {
  return workoutExerciseToDraftRow(exercise, { clientId: exercise.id, sourceExerciseId: exercise.id });
}

export default function WorkoutEditScreen() {
  const { id, importExercises } = useLocalSearchParams<{ id?: string; importExercises?: string | string[] }>();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<DayOfWeek[]>(['Monday']);
  const [iconId, setIconId] = useState<WorkoutIconId>(DEFAULT_WORKOUT_ICON_ID);
  const [exercises, setExercises] = useState<ExerciseDraftRow[]>([]);
  /** `clientId`s for linked exercises the user chose to edit after confirmation. */
  const [unlockedExerciseClientIds, setUnlockedExerciseClientIds] = useState(() => new Set<string>());
  const editScreenInitialLoadDoneRef = useRef(false);

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

  useEffect(() => {
    setUnlockedExerciseClientIds(new Set());
  }, [id, importExercises]);

  /** Load workout and apply Exercise Library imports in one pass so async load cannot overwrite imported exercises. */
  useEffect(() => {
    if (!id) {
      themedAlert('Workout not found', 'Missing workout id.');
      router.back();
      return;
    }

    let cancelled = false;

    editScreenInitialLoadDoneRef.current = false;

    void (async () => {
      const workouts = await loadWorkouts();
      if (cancelled) {
        return;
      }
      const workout = workouts.find((w) => w.id === id);
      if (!workout) {
        themedAlert('Workout not found', 'Could not find this workout.');
        router.back();
        return;
      }

      setTitle(workout.title);
      setDaysOfWeek(workout.daysOfWeek);
      setIconId(workout.iconId);

      const rawImport = Array.isArray(importExercises) ? importExercises[0] : importExercises;

      if (rawImport) {
        try {
          const parsed = JSON.parse(rawImport) as ImportExercisesPayload;
          if (Array.isArray(parsed.exercises)) {
            setExercises(parsed.exercises.map((exercise) => exerciseDraftRowFromSeed(exercise)));
            if (!cancelled) {
              setLoading(false);
              editScreenInitialLoadDoneRef.current = true;
            }
            return;
          }
        } catch {
          // Ignore malformed payload; fall back to workout from storage below.
        }
      }

      setExercises(workout.exercises.map(toDraft));
      if (!cancelled) {
        setLoading(false);
        editScreenInitialLoadDoneRef.current = true;
      }
    })();

    return () => {
      cancelled = true;
      editScreenInitialLoadDoneRef.current = false;
    };
  }, [id, importExercises]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !editScreenInitialLoadDoneRef.current) {
        return undefined;
      }
      let cancelled = false;
      void (async () => {
        const workouts = await loadWorkouts();
        if (cancelled) {
          return;
        }
        const workout = workouts.find((w) => w.id === id);
        if (!workout) {
          return;
        }
        const byId = new Map(workout.exercises.map((e) => [e.id, e]));
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
            const latest = byId.get(templateId);
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
    }, [id]),
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
      prev.map((ex) => (ex.clientId === exerciseId ? applyActivityTypeChangeToDraftRow(ex, activityType) : ex)),
    );
  };

  const updateExerciseField = (
    exerciseId: string,
    field: 'sets' | 'reps' | 'weight' | 'duration' | 'distance' | 'score',
    value: string,
  ) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, [field]: value } : ex)));
  };

  const updateExerciseDistanceUnit = (exerciseId: string, unit: CardioDistanceUnit) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, distanceUnit: unit } : ex)));
  };

  const updateExerciseCardioObjective = (exerciseId: string, objective: CardioObjective) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? applyCardioObjectiveChangeToDraftRow(ex, objective) : ex)),
    );
  };

  const updateExerciseCardioDurationTracking = (exerciseId: string, tracking: CardioDurationTracking) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.clientId === exerciseId ? applyCardioDurationTrackingChangeToDraftRow(ex, tracking) : ex,
      ),
    );
  };

  const updateExerciseCardioDistanceTracking = (exerciseId: string, tracking: CardioDistanceTracking) => {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.clientId === exerciseId ? applyCardioDistanceTrackingChangeToDraftRow(ex, tracking) : ex,
      ),
    );
  };

  const updateExerciseDurationUnit = (exerciseId: string, unit: DurationUnit) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, durationUnit: unit } : ex)));
  };

  const updateExerciseScoreUnit = (exerciseId: string, unit: ScoreUnit) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, scoreUnit: unit } : ex)));
  };

  const updateExerciseWeightUnit = (exerciseId: string, unit: WeightUnit) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, weightUnit: unit } : ex)));
  };

  const parseWorkout = (): Omit<Workout, 'id' | 'createdAt'> | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      themedAlert('Missing title', 'Give this workout a title.');
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
      const result = parseWorkoutExerciseFromDraft(ex, ex.clientId);
      if (!result.ok) {
        if (result.title) {
          themedAlert(result.title, result.message);
        }
        return null;
      }
      parsedExercises.push(result.exercise);
    }

    if (parsedExercises.length === 0) {
      themedAlert('Add an exercise', 'Enter at least one complete exercise.');
      return null;
    }

    return { title: trimmedTitle, daysOfWeek, iconId, exercises: parsedExercises };
  };

  const onSave = () => {
    if (!id) {
      return;
    }
    const parsed = parseWorkout();
    if (!parsed) {
      return;
    }

    void (async () => {
      const allWorkouts = await loadWorkouts();
      const nameCheck = validateExerciseNamesForWorkoutSave(allWorkouts, id, parsed.exercises);
      if (!nameCheck.ok) {
        themedAlert(nameCheck.title, nameCheck.message);
        return;
      }
      const updated = await updateWorkout(id, parsed);
      if (!updated) {
        themedAlert('Workout not found', 'Could not update this workout.');
        return;
      }
      await propagateExerciseDefinitionsAcrossWorkouts(parsed.exercises);
      // Don't use router.back() — stack may be workouts → edit → exercise-library → edit, and back()
      // would reopen the library. Match Create Workout: land on Workouts tab.
      router.replace('/');
    })();
  };

  const openExerciseLibraryFromMenu = useCallback(() => {
    if (!id) {
      return;
    }
    router.push({
      pathname: '/exercise-library',
      params: {
        libraryEntry: 'menu',
        source: 'edit',
        workoutId: id,
        existingExercises: JSON.stringify(exercises.map((exercise) => exerciseDraftSeedFromRow(exercise))),
      },
    });
  }, [id, exercises]);

  return (
    <RNView style={styles.screenWrap}>
      <Stack.Screen options={{ title: 'Edit Workout', ...stackHeaderHideIosBackLabel }} />
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors[activeScheme].tint} />
        </View>
      ) : (
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
        onUpdateExerciseCardioObjective={updateExerciseCardioObjective}
        onUpdateExerciseCardioDurationTracking={updateExerciseCardioDurationTracking}
        onUpdateExerciseCardioDistanceTracking={updateExerciseCardioDistanceTracking}
        onUpdateExerciseDurationUnit={updateExerciseDurationUnit}
        onUpdateExerciseScoreUnit={updateExerciseScoreUnit}
        onUpdateExerciseWeightUnit={updateExerciseWeightUnit}
        onRemoveExercise={removeExercise}
        confirmBeforeRemoveExercise
        contentContainerStyle={styles.scroll}
        listHeader={
          <>
            <Text style={styles.label}>Workout name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Workout name"
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
                      source: 'edit',
                      workoutId: id,
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
          <StickySaveFooter onPress={onSave} activeScheme={activeScheme} />
        </KeyboardAvoidingView>
      )}
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
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
