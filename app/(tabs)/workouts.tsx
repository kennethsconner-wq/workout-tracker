import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import { WorkoutIconPicker } from '@/components/WorkoutIconPicker';
import { WorkoutDaysPicker } from '@/components/WorkoutDaysPicker';
import { DEFAULT_WORKOUT_ICON_ID, normalizeWorkoutIconId, type WorkoutIconId } from '@/lib/workoutIcons';
import { DAYS_OF_WEEK, type DayOfWeek, type Workout, type WorkoutExercise } from '@/lib/types';
import { confirmEditLinkedExercise } from '@/lib/linkedExerciseEdit';
import { addWorkout, propagateExerciseDefinitionsAcrossWorkouts } from '@/lib/workoutsStorage';

type DraftExercise = { clientId: string; sourceExerciseId?: string; name: string; sets: string; reps: string; weightKg: string };
type CopyWorkoutPayload = Pick<Workout, 'title' | 'daysOfWeek' | 'iconId'> & {
  exercises: Array<Pick<WorkoutExercise, 'name' | 'sets' | 'reps' | 'weightKg'>>;
};
type ExerciseDraftSeed = { sourceExerciseId?: string; name: string; sets: string; reps: string; weightKg: string };
type ImportExercisesPayload = {
  nonce: string;
  exercises: ExerciseDraftSeed[];
  /** Preserves Create Workout form when returning from Exercise Library (screen remounts). */
  createDraft?: { title: string; daysOfWeek: DayOfWeek[]; iconId: WorkoutIconId };
};

function isDayOfWeekString(value: string): value is DayOfWeek {
  return (DAYS_OF_WEEK as readonly string[]).includes(value);
}

function emptyExercise(): DraftExercise {
  return { clientId: newId(), name: '', sets: '', reps: '', weightKg: '' };
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
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
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
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, [field]: value } : ex)),
    );
  };

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

      const mappedDrafts = parsed.exercises.map((ex) => ({
        clientId: newId(),
        sourceExerciseId: undefined,
        name: ex.name,
        sets: String(ex.sets),
        reps: String(ex.reps),
        weightKg: String(ex.weightKg),
      }));
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
      setExercises(
        parsed.exercises.map((exercise) => ({
          clientId: newId(),
          sourceExerciseId: exercise.sourceExerciseId,
          name: exercise.name,
          sets: exercise.sets,
          reps: exercise.reps,
          weightKg: exercise.weightKg,
        })),
      );
      setUnlockedExerciseClientIds(new Set());
      lastAppliedImportExercisesRef.current = raw;
    } catch {
      // Ignore malformed deep-link data and keep the current draft.
    }
  }, [params.importExercises]);

  const parseWorkout = (): Omit<Workout, 'id' | 'createdAt'> | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Give this session a short name (for example, “Upper body”).');
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
        Alert.alert('Name your exercise', 'One of your sets is missing an exercise name.');
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
        Alert.alert('Check your numbers', 'Each exercise needs a positive set count, positive rep count, and a weight (use 0 for bodyweight).');
        return null;
      }

      parsedExercises.push({
        id: ex.sourceExerciseId ?? newId(),
        name,
        sets: setsCount,
        reps,
        weightKg,
      });
    }

    if (parsedExercises.length === 0) {
      Alert.alert('Add an exercise', 'Enter at least one exercise name and one complete set.');
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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 24 })}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Workout name</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Push day"
          placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
          style={inputStyle}
        />
        <WorkoutDaysPicker value={daysOfWeek} onChange={setDaysOfWeek} />

        <WorkoutIconPicker value={iconId} onChange={setIconId} />

        {exercises.map((exercise, exIndex) => {
          const fieldsLocked =
            exercise.sourceExerciseId !== undefined && !unlockedExerciseClientIds.has(exercise.clientId);
          const lockedFieldStyle = fieldsLocked ? { opacity: 0.62 } : null;
          return (
          <View key={exercise.clientId} style={[styles.card, { borderColor }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardHeading, styles.cardHeaderTitle]} numberOfLines={1}>
                Exercise {exIndex + 1}
              </Text>
              <View style={styles.cardHeaderActions}>
                {exercise.sourceExerciseId !== undefined && fieldsLocked ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit linked exercise"
                    onPress={() =>
                      confirmEditLinkedExercise(() =>
                        setUnlockedExerciseClientIds((prev) => new Set(prev).add(exercise.clientId)),
                      )
                    }
                    hitSlop={8}
                    style={({ pressed }) => [styles.exerciseHeaderIconPressable, pressed && styles.exerciseHeaderIconPressed]}>
                    <Ionicons name="pencil-outline" size={22} color={Colors[activeScheme].tint} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove exercise"
                  onPress={() => removeExercise(exercise.clientId)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.exerciseHeaderIconPressable, pressed && styles.exerciseHeaderIconPressed]}>
                  <Ionicons name="close-outline" size={26} color="#ef4444" />
                </Pressable>
              </View>
            </View>
            <TextInput
              value={exercise.name}
              onChangeText={(value) => updateExerciseName(exercise.clientId, value)}
              placeholder="Exercise name"
              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
              editable={!fieldsLocked}
              style={[inputStyle, lockedFieldStyle]}
            />

            <View style={styles.setRow}>
              <View style={styles.unitInputWrap}>
                <TextInput
                  value={exercise.sets}
                  onChangeText={(value) => updateExerciseField(exercise.clientId, 'sets', value)}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                  editable={!fieldsLocked}
                  style={[
                    styles.input,
                    styles.setInput,
                    styles.unitInput,
                    { color: textColor, borderColor, backgroundColor: inputBackground },
                    lockedFieldStyle,
                  ]}
                />
                <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>sets</Text>
              </View>
              <View style={styles.unitInputWrap}>
                <TextInput
                  value={exercise.reps}
                  onChangeText={(value) => updateExerciseField(exercise.clientId, 'reps', value)}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                  editable={!fieldsLocked}
                  style={[
                    styles.input,
                    styles.setInput,
                    styles.unitInput,
                    { color: textColor, borderColor, backgroundColor: inputBackground },
                    lockedFieldStyle,
                  ]}
                />
                <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>reps</Text>
              </View>
              <View style={styles.unitInputWrap}>
                <TextInput
                  value={exercise.weightKg}
                  onChangeText={(value) => updateExerciseField(exercise.clientId, 'weightKg', value)}
                  placeholder="Weight"
                  keyboardType="decimal-pad"
                  placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                  editable={!fieldsLocked}
                  style={[
                    styles.input,
                    styles.setInput,
                    styles.unitInput,
                    { color: textColor, borderColor, backgroundColor: inputBackground },
                    lockedFieldStyle,
                  ]}
                />
                <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>lb</Text>
              </View>
            </View>
          </View>
          );
        })}

        <View style={styles.exerciseActionsRow}>
          <Pressable onPress={addExercise} style={styles.secondaryButton}>
            <Text style={[styles.secondaryButtonLabel, { color: Colors[activeScheme].tint }]}>Create Exercise</Text>
          </Pressable>
          <Text style={styles.orLabel}>or</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/exercise-library',
                params: {
                  source: 'create',
                  createDraft: JSON.stringify({ title, daysOfWeek, iconId }),
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
            <Text style={[styles.secondaryButtonLabel, { color: Colors[activeScheme].tint }]}>Add Existing</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={onSave}
          style={[styles.primaryButton, { backgroundColor: Colors[activeScheme].tint }]}>
          <Text style={styles.primaryButtonLabel}>Save workout</Text>
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
  cardHeaderTitle: {
    flex: 1,
    minWidth: 0,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  exerciseHeaderIconPressable: {
    padding: 4,
  },
  exerciseHeaderIconPressed: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  setInput: {
    flexGrow: 1,
    minWidth: 80,
  },
  unitInputWrap: {
    flexGrow: 1,
    minWidth: 80,
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
