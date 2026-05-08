import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { newId } from '@/lib/ids';
import type { LoggedWorkoutExercise, Workout } from '@/lib/types';
import { addLoggedWorkout, loadWorkouts } from '@/lib/workoutsStorage';

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
  exercises: DraftExercise[];
  updatedAt: string;
};

function hasActualSetValues(actualSet: DraftActualSet): boolean {
  return actualSet.actualRepsInput.trim().length > 0 && actualSet.actualWeightKgInput.trim().length > 0;
}

function draftStorageKey(workoutId: string): string {
  return `workout-log-draft@v1:${workoutId}`;
}

function normalizeDraftExercises(workout: Workout, savedExercises: unknown): DraftExercise[] {
  const savedList = Array.isArray(savedExercises) ? (savedExercises as DraftExercise[]) : [];
  const byWorkoutExerciseId = new Map(
    savedList
      .filter((exercise): exercise is DraftExercise => !!exercise && typeof exercise.workoutExerciseId === 'string')
      .map((exercise) => [exercise.workoutExerciseId, exercise]),
  );
  return workout.exercises.map((exercise) => {
    const saved = byWorkoutExerciseId.get(exercise.id);
    return {
      id: saved?.id && typeof saved.id === 'string' ? saved.id : newId(),
      workoutExerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      weightKg: exercise.weightKg,
      actualSets: Array.from({ length: exercise.sets }, (_, setIndex) => {
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
  const params = useLocalSearchParams<{ workoutId?: string | string[] }>();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';

  const [loading, setLoading] = useState(true);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [loadedFromDraft, setLoadedFromDraft] = useState(false);
  const skipAutosaveRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

    const workoutId = Array.isArray(params.workoutId) ? params.workoutId[0] : params.workoutId;
    if (!workoutId) {
      Alert.alert('Workout not found', 'Please start from a workout card to log this session.');
      router.replace('/');
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      setLoading(true);
      setDraftHydrated(false);
      setLoadedFromDraft(false);
      skipAutosaveRef.current = false;

      const allWorkouts = await loadWorkouts();
      const selectedWorkout = allWorkouts.find((entry) => entry.id === workoutId);
      if (!selectedWorkout) {
        Alert.alert('Workout not found', 'Could not find the workout template for this log.');
        router.replace('/');
        return;
      }
      const storageKey = draftStorageKey(selectedWorkout.id);
      const rawDraft = await AsyncStorage.getItem(storageKey);
      let nextExercises = toDraftExercises(selectedWorkout);
      let didLoadDraft = false;
      if (rawDraft) {
        try {
          const parsed = JSON.parse(rawDraft) as LogWorkoutDraft;
          if (parsed && parsed.workoutId === selectedWorkout.id) {
            nextExercises = normalizeDraftExercises(selectedWorkout, parsed.exercises);
            didLoadDraft = true;
          }
        } catch {
          nextExercises = toDraftExercises(selectedWorkout);
        }
      }
      if (cancelled) {
        return;
      }
      setWorkout(selectedWorkout);
      setExercises(nextExercises);
      setLoadedFromDraft(didLoadDraft);
      setDraftHydrated(true);
      setLoading(false);
    })();

      return () => {
        cancelled = true;
      };
    }, [params.workoutId]),
  );

  useEffect(() => {
    if (!workout || !draftHydrated || skipAutosaveRef.current) {
      return;
    }
    void AsyncStorage.setItem(
      draftStorageKey(workout.id),
      JSON.stringify({
        workoutId: workout.id,
        exercises,
        updatedAt: new Date().toISOString(),
      } as LogWorkoutDraft),
    );
  }, [draftHydrated, exercises, workout]);

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

  const deleteActualSet = (exerciseId: string, actualSetId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id !== exerciseId) {
          return ex;
        }
        if (ex.actualSets.length <= 1) {
          Alert.alert('Keep one set', 'Each exercise needs at least one set. Add another set before deleting this one.');
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
          Alert.alert('Check your numbers', `Enter positive reps for set ${setIndex + 1} of "${ex.name}".`);
          return null;
        }
        if (!Number.isFinite(actualWeightKg) || actualWeightKg < 0) {
          Alert.alert(
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
      Alert.alert('No exercises found', 'This workout has no exercises to log.');
      return null;
    }

    return { workout, exercises: parsedExercises };
  };

  const onSave = () => {
    const parsed = parseWorkout();
    if (!parsed) {
      return;
    }
    skipAutosaveRef.current = true;

    void (async () => {
      try {
        await addLoggedWorkout({
          workoutId: parsed.workout.id,
          title: parsed.workout.title,
          daysOfWeek: parsed.workout.daysOfWeek,
          iconId: parsed.workout.iconId,
          exercises: parsed.exercises,
        });
        await AsyncStorage.removeItem(draftStorageKey(parsed.workout.id));
        router.replace('/');
      } catch {
        skipAutosaveRef.current = false;
        Alert.alert('Save failed', 'Could not save this workout. Please try again.');
      }
    })();
  };

  const onStartFresh = () => {
    if (!workout) {
      return;
    }
    Alert.alert('Start a new log?', 'This will clear your current in-progress draft for this workout.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start fresh',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await AsyncStorage.removeItem(draftStorageKey(workout.id));
            setExercises(toDraftExercises(workout));
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.workoutTitleRow} lightColor="transparent" darkColor="transparent">
          <View style={styles.workoutTitleTextRow} lightColor="transparent" darkColor="transparent">
            <Text style={[styles.workoutTitle, { color: textColor }]}>{workout.title}</Text>
            {loadedFromDraft ? <Text style={styles.draftBadge}>(Draft)</Text> : null}
          </View>
          {loadedFromDraft ? (
            <Pressable onPress={onStartFresh} hitSlop={8} style={({ pressed }) => [pressed && styles.checkboxButtonPressed]}>
              <Ionicons name="trash-outline" size={22} color="#ef4444" />
            </Pressable>
          ) : null}
        </View>

        {exercises.map((exercise, exIndex) => (
          <View key={exercise.id} style={[styles.card, { borderColor }]}>
            <Text style={styles.cardHeading}>Exercise {exIndex + 1}</Text>
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

        <Pressable
          onPress={onSave}
          style={[styles.primaryButton, { backgroundColor: Colors[activeScheme].tint }]}>
          <Text style={[styles.primaryButtonLabel, { color: Colors[activeScheme].background }]}>Save</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  workoutTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  workoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  workoutTitleTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
