import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useNavigation, useFocusEffect, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';

import { DraftExerciseDraggableList } from '@/components/DraftExerciseDraggableList';
import { WorkoutFormExerciseLibraryMenu } from '@/components/WorkoutFormExerciseLibraryMenu';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import { newId } from '@/lib/ids';
import { WorkoutIconPicker } from '@/components/WorkoutIconPicker';
import { WorkoutDaysPicker } from '@/components/WorkoutDaysPicker';
import { DEFAULT_WORKOUT_ICON_ID, type WorkoutIconId } from '@/lib/workoutIcons';
import { type DayOfWeek, type Workout, type WorkoutExercise } from '@/lib/types';
import { loadWorkouts, propagateExerciseDefinitionsAcrossWorkouts, updateWorkout } from '@/lib/workoutsStorage';

type DraftExercise = { clientId: string; sourceExerciseId?: string; name: string; sets: string; reps: string; weightKg: string };
type ExerciseDraftSeed = { sourceExerciseId?: string; name: string; sets: string; reps: string; weightKg: string };
type ImportExercisesPayload = { nonce: string; exercises: ExerciseDraftSeed[] };

function emptyExercise(): DraftExercise {
  return { clientId: newId(), name: '', sets: '', reps: '', weightKg: '' };
}

function toDraft(exercise: WorkoutExercise): DraftExercise {
  return {
    clientId: exercise.id,
    sourceExerciseId: exercise.id,
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weightKg: String(exercise.weightKg),
  };
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
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
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
      Alert.alert('Workout not found', 'Missing workout id.');
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
        Alert.alert('Workout not found', 'Could not find this workout.');
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
            setExercises(
              parsed.exercises.map((exercise) => ({
                clientId: exercise.sourceExerciseId ?? newId(),
                sourceExerciseId: exercise.sourceExerciseId,
                name: exercise.name,
                sets: exercise.sets,
                reps: exercise.reps,
                weightKg: exercise.weightKg,
              })),
            );
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
          const next: DraftExercise[] = [];
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
            next.push({
              ...ex,
              name: latest.name,
              sets: String(latest.sets),
              reps: String(latest.reps),
              weightKg: String(latest.weightKg),
            });
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
    setExercises((prev) => [...prev, emptyExercise()]);
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

  const updateExerciseField = (exerciseId: string, field: keyof Pick<DraftExercise, 'sets' | 'reps' | 'weightKg'>, value: string) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, [field]: value } : ex)));
  };

  const parseWorkout = (): Omit<Workout, 'id' | 'createdAt'> | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Give this workout a title.');
      return null;
    }
    if (daysOfWeek.length === 0) {
      Alert.alert('Choose at least one day', 'Select one or more days of the week for this workout.');
      return null;
    }

    const parsedExercises: WorkoutExercise[] = [];
    for (const ex of exercises) {
      const name = ex.name.trim();
      const setsRaw = ex.sets.trim();
      const repsRaw = ex.reps.trim();
      const weightRaw = ex.weightKg.trim().replace(',', '.');

      if (!name && !setsRaw && !repsRaw && !weightRaw) {
        continue;
      }

      if (!name) {
        Alert.alert('Name your exercise', 'One entry is missing an exercise name.');
        return null;
      }

      const setsCount = Number.parseInt(setsRaw, 10);
      const reps = Number.parseInt(repsRaw, 10);
      const weightKg = Number.parseFloat(weightRaw);
      if (
        !Number.isFinite(setsCount) ||
        setsCount <= 0 ||
        !Number.isFinite(reps) ||
        reps <= 0 ||
        !Number.isFinite(weightKg) ||
        weightKg < 0
      ) {
        Alert.alert('Check your numbers', 'Each exercise needs a positive set count, positive rep count, and a weight.');
        return null;
      }

      parsedExercises.push({
        id: ex.sourceExerciseId ?? ex.clientId,
        name,
        sets: setsCount,
        reps,
        weightKg,
      });
    }

    if (parsedExercises.length === 0) {
      Alert.alert('Add an exercise', 'Enter at least one complete exercise.');
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
      const updated = await updateWorkout(id, parsed);
      if (!updated) {
        Alert.alert('Workout not found', 'Could not update this workout.');
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
        existingExercises: JSON.stringify(
          exercises.map((exercise) => ({
            sourceExerciseId: exercise.sourceExerciseId,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weightKg: exercise.weightKg,
          })),
        ),
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
        onUpdateExerciseField={updateExerciseField}
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
                      existingExercises: JSON.stringify(
                        exercises.map((exercise) => ({
                          sourceExerciseId: exercise.sourceExerciseId,
                          name: exercise.name,
                          sets: exercise.sets,
                          reps: exercise.reps,
                          weightKg: exercise.weightKg,
                        })),
                      ),
                    },
                  })
                }
                style={styles.secondaryButton}>
                <Text style={[styles.secondaryButtonLabel, { color: Colors[activeScheme].tint }]}>
                  Add Existing
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={onSave} style={[styles.primaryButton, { backgroundColor: Colors[activeScheme].tint }]}>
              <Text style={[styles.primaryButtonLabel, { color: Colors[activeScheme].background }]}>Save</Text>
            </Pressable>
          </>
        }
      />
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
    paddingBottom: 32,
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
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
