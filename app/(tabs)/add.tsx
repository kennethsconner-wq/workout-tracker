import { router, useLocalSearchParams } from 'expo-router';
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
import type { LoggedWorkoutExercise, Workout } from '@/lib/types';
import { addLoggedWorkout, loadWorkouts } from '@/lib/workoutsStorage';

type DraftExercise = LoggedWorkoutExercise & {
  actualSetsInput: string;
  actualRepsInput: string;
  actualWeightKgInput: string;
};

function toDraftExercises(workout: Workout): DraftExercise[] {
  return workout.exercises.map((exercise) => ({
    id: newId(),
    workoutExerciseId: exercise.id,
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    weightKg: exercise.weightKg,
    actualSets: exercise.sets,
    actualReps: exercise.reps,
    actualWeightKg: exercise.weightKg,
    actualSetsInput: String(exercise.sets),
    actualRepsInput: String(exercise.reps),
    actualWeightKgInput: String(exercise.weightKg),
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

  const inputStyle = [styles.input, { color: textColor, borderColor, backgroundColor: inputBackground }];

  useEffect(() => {
    const workoutId = Array.isArray(params.workoutId) ? params.workoutId[0] : params.workoutId;
    if (!workoutId) {
      Alert.alert('Workout not found', 'Please start from a workout card to log this session.');
      router.replace('/');
      return;
    }

    void (async () => {
      const allWorkouts = await loadWorkouts();
      const selectedWorkout = allWorkouts.find((entry) => entry.id === workoutId);
      if (!selectedWorkout) {
        Alert.alert('Workout not found', 'Could not find the workout template for this log.');
        router.replace('/');
        return;
      }
      setWorkout(selectedWorkout);
      setExercises(toDraftExercises(selectedWorkout));
      setLoading(false);
    })();
  }, [params.workoutId]);

  const updateExerciseField = (
    exerciseId: string,
    field: keyof Pick<DraftExercise, 'actualSetsInput' | 'actualRepsInput' | 'actualWeightKgInput'>,
    value: string,
  ) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === exerciseId ? { ...ex, [field]: value } : ex)),
    );
  };

  const parseWorkout = (): { workout: Workout; exercises: LoggedWorkoutExercise[] } | null => {
    if (!workout) {
      return null;
    }

    const parsedExercises: LoggedWorkoutExercise[] = [];

    for (const ex of exercises) {
      const actualSets = Number.parseInt(ex.actualSetsInput.trim(), 10);
      const actualReps = Number.parseInt(ex.actualRepsInput.trim(), 10);
      const actualWeightKg = Number.parseFloat(ex.actualWeightKgInput.trim().replace(',', '.'));

      if (!Number.isFinite(actualSets) || actualSets <= 0 || !Number.isFinite(actualReps) || actualReps <= 0) {
        Alert.alert('Check your numbers', `Enter positive actual sets and reps for "${ex.name}".`);
        return null;
      }
      if (!Number.isFinite(actualWeightKg) || actualWeightKg < 0) {
        Alert.alert('Check your numbers', `Enter a valid actual weight (0 for bodyweight) for "${ex.name}".`);
        return null;
      }

      parsedExercises.push({
        id: ex.id,
        workoutExerciseId: ex.workoutExerciseId,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weightKg: ex.weightKg,
        actualSets,
        actualReps,
        actualWeightKg,
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

    void (async () => {
      await addLoggedWorkout({
        workoutId: parsed.workout.id,
        title: parsed.workout.title,
        daysOfWeek: parsed.workout.daysOfWeek,
        iconId: parsed.workout.iconId,
        exercises: parsed.exercises,
      });
      router.replace('/');
    })();
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
        <Text style={styles.label}>Workout</Text>
        <Text style={[styles.workoutTitle, { color: textColor }]}>{workout.title}</Text>

        {exercises.map((exercise, exIndex) => (
          <View key={exercise.id} style={[styles.card, { borderColor }]}>
            <Text style={styles.cardHeading}>Exercise {exIndex + 1}</Text>
            <Text style={[styles.exerciseName, { color: textColor }]}>{exercise.name}</Text>
            <Text style={styles.plannedLine}>
              Planned: {exercise.sets} set{exercise.sets === 1 ? '' : 's'} x {exercise.reps} reps @ {exercise.weightKg} lb
            </Text>
            <View style={styles.setRow}>
              <TextInput
                value={exercise.actualSetsInput}
                onChangeText={(value) => updateExerciseField(exercise.id, 'actualSetsInput', value)}
                placeholder="Actual sets"
                keyboardType="number-pad"
                placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                style={[styles.input, styles.setInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
              />
              <TextInput
                value={exercise.actualRepsInput}
                onChangeText={(value) => updateExerciseField(exercise.id, 'actualRepsInput', value)}
                placeholder="Actual reps"
                keyboardType="number-pad"
                placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                style={[styles.input, styles.setInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
              />
              <TextInput
                value={exercise.actualWeightKgInput}
                onChangeText={(value) => updateExerciseField(exercise.id, 'actualWeightKgInput', value)}
                placeholder="Actual lb"
                keyboardType="decimal-pad"
                placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                style={[styles.input, styles.setInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
              />
            </View>
          </View>
        ))}

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
  workoutTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    flexWrap: 'wrap',
  },
  setInput: {
    flexGrow: 1,
    minWidth: 100,
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
