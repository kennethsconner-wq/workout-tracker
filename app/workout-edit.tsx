import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { WorkoutIconPicker } from '@/components/WorkoutIconPicker';
import { DEFAULT_WORKOUT_ICON_ID, type WorkoutIconId } from '@/lib/workoutIcons';
import { DAYS_OF_WEEK, type DayOfWeek, type Workout, type WorkoutExercise } from '@/lib/types';
import { loadWorkouts, updateWorkout } from '@/lib/workoutsStorage';

type DraftExercise = { clientId: string; name: string; sets: string; reps: string; weightKg: string };

function emptyExercise(): DraftExercise {
  return { clientId: newId(), name: '', sets: '', reps: '', weightKg: '' };
}

function toDraft(exercise: WorkoutExercise): DraftExercise {
  return {
    clientId: exercise.id,
    name: exercise.name,
    sets: String(exercise.sets),
    reps: String(exercise.reps),
    weightKg: String(exercise.weightKg),
  };
}

export default function WorkoutEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('Monday');
  const [isDayDropdownOpen, setIsDayDropdownOpen] = useState(false);
  const [iconId, setIconId] = useState<WorkoutIconId>(DEFAULT_WORKOUT_ICON_ID);
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()]);

  const inputStyle = [styles.input, { color: textColor, borderColor, backgroundColor: inputBackground }];

  const closeDayDropdown = () => {
    setIsDayDropdownOpen(false);
  };

  useEffect(() => {
    if (!id) {
      Alert.alert('Workout not found', 'Missing workout id.');
      router.back();
      return;
    }

    void (async () => {
      const workouts = await loadWorkouts();
      const workout = workouts.find((w) => w.id === id);
      if (!workout) {
        Alert.alert('Workout not found', 'Could not find this workout.');
        router.back();
        return;
      }

      setTitle(workout.title);
      setDayOfWeek(workout.dayOfWeek);
      setIconId(workout.iconId);
      setExercises(workout.exercises.length > 0 ? workout.exercises.map(toDraft) : [emptyExercise()]);
      setLoading(false);
    })();
  }, [id]);

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExercise()]);
  };

  const removeExercise = (exerciseId: string) => {
    setExercises((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((ex) => ex.clientId !== exerciseId);
    });
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
        id: ex.clientId,
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

    return { title: trimmedTitle, dayOfWeek, iconId, exercises: parsedExercises };
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
      router.back();
    })();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors[activeScheme].tint} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 24 })}>
      <Stack.Screen options={{ title: 'Edit Workout' }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        onTouchStart={closeDayDropdown}>
        <Text style={styles.label}>Workout name</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Workout name"
          placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
          style={inputStyle}
        />

        <Text style={styles.label}>Day of the Week</Text>
        <View style={styles.dropdownWrap} onTouchStart={(event) => event.stopPropagation()}>
          <Pressable
            onPress={() => setIsDayDropdownOpen((prev) => !prev)}
            style={[
              styles.dropdownTrigger,
              {
                borderColor,
                backgroundColor: inputBackground,
              },
            ]}>
            <Text style={[styles.dropdownValue, { color: textColor }]}>{dayOfWeek}</Text>
            <Text style={[styles.dropdownArrow, { color: textColor }]}>{isDayDropdownOpen ? '^' : 'v'}</Text>
          </Pressable>

          {isDayDropdownOpen ? (
            <View style={[styles.dropdownMenu, { borderColor, backgroundColor: inputBackground }]}>
              {DAYS_OF_WEEK.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => {
                    setDayOfWeek(day);
                    setIsDayDropdownOpen(false);
                  }}
                  style={[styles.dropdownOption, dayOfWeek === day && { backgroundColor: Colors[activeScheme].tint }]}>
                  <Text style={[styles.dropdownOptionLabel, { color: dayOfWeek === day ? '#fff' : textColor }]}>
                    {day}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        <WorkoutIconPicker value={iconId} onChange={setIconId} />

        {exercises.map((exercise, exIndex) => (
          <View key={exercise.clientId} style={[styles.card, { borderColor }]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeading}>Exercise {exIndex + 1}</Text>
              {exercises.length > 1 ? (
                <Pressable onPress={() => removeExercise(exercise.clientId)} hitSlop={6}>
                  <Text style={styles.removeExercise}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <TextInput
              value={exercise.name}
              onChangeText={(value) => updateExerciseName(exercise.clientId, value)}
              placeholder="Exercise name"
              placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
              style={inputStyle}
            />
            <View style={styles.setRow}>
              <View style={styles.unitInputWrap}>
                <TextInput
                  value={exercise.sets}
                  onChangeText={(value) => updateExerciseField(exercise.clientId, 'sets', value)}
                  placeholder="0"
                  keyboardType="number-pad"
                  placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                  style={[styles.input, styles.setInput, styles.unitInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
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
                  style={[styles.input, styles.setInput, styles.unitInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
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
                  style={[styles.input, styles.setInput, styles.unitInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
                />
                <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>lb</Text>
              </View>
            </View>
          </View>
        ))}

        <Pressable onPress={addExercise} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonLabel, { color: Colors[activeScheme].tint }]}>Add another exercise</Text>
        </Pressable>

        <Pressable onPress={onSave} style={[styles.primaryButton, { backgroundColor: Colors[activeScheme].tint }]}>
          <Text style={styles.primaryButtonLabel}>Save changes</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
  dropdownWrap: {
    gap: 8,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: {
    fontSize: 16,
  },
  dropdownArrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  removeExercise: {
    color: '#ef4444',
    fontWeight: '600',
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
