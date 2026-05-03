import { router } from 'expo-router';
import { useState } from 'react';
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
import type { LoggedWorkoutExercise, LoggedWorkoutSet } from '@/lib/types';
import { addLoggedWorkout } from '@/lib/workoutsStorage';

type DraftSet = { clientId: string; reps: string; weightKg: string };
type DraftExercise = { clientId: string; name: string; sets: DraftSet[] };

function emptySet(): DraftSet {
  return { clientId: newId(), reps: '', weightKg: '' };
}

function emptyExercise(): DraftExercise {
  return { clientId: newId(), name: '', sets: [emptySet()] };
}

export default function LogWorkoutScreen() {
  const colorScheme = useColorScheme();
  const textColor = Colors[colorScheme].text;
  const borderColor = colorScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = colorScheme === 'dark' ? '#171717' : '#fafafa';

  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()]);

  const inputStyle = [styles.input, { color: textColor, borderColor, backgroundColor: inputBackground }];

  const addExercise = () => {
    setExercises((prev) => [...prev, emptyExercise()]);
  };

  const addSet = (exerciseId: string) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, sets: [...ex.sets, emptySet()] } : ex)),
    );
  };

  const updateExerciseName = (exerciseId: string, name: string) => {
    setExercises((prev) => prev.map((ex) => (ex.clientId === exerciseId ? { ...ex, name } : ex)));
  };

  const updateSet = (exerciseId: string, setId: string, field: keyof Pick<DraftSet, 'reps' | 'weightKg'>, value: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.clientId !== exerciseId) {
          return ex;
        }
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.clientId === setId ? { ...s, [field]: value } : s)),
        };
      }),
    );
  };

  const removeSet = (exerciseId: string, setId: string) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.clientId !== exerciseId) {
          return ex;
        }
        if (ex.sets.length <= 1) {
          return ex;
        }
        return { ...ex, sets: ex.sets.filter((s) => s.clientId !== setId) };
      }),
    );
  };

  const parseWorkout = (): { title: string; exercises: LoggedWorkoutExercise[] } | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Give this session a short name (for example, “Upper body”).');
      return null;
    }

    const parsedExercises: LoggedWorkoutExercise[] = [];

    for (const ex of exercises) {
      const name = ex.name.trim();
      const sets: LoggedWorkoutSet[] = [];

      for (const s of ex.sets) {
        const repsRaw = s.reps.trim();
        const weightRaw = s.weightKg.trim().replace(',', '.');

        if (!repsRaw && !weightRaw) {
          continue;
        }

        const reps = Number.parseInt(repsRaw, 10);
        const weightKg = Number.parseFloat(weightRaw);

        if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weightKg) || weightKg < 0) {
          Alert.alert(
            'Check your numbers',
            'Each filled-in set needs a positive rep count and a weight (use 0 for bodyweight).',
          );
          return null;
        }

        sets.push({ reps, weightKg });
      }

      if (!name) {
        if (sets.length > 0) {
          Alert.alert('Name your exercise', 'One of your sets is missing an exercise name.');
          return null;
        }
        continue;
      }

      if (sets.length === 0) {
        Alert.alert('Add sets', `Add at least one complete set for “${name}”.`);
        return null;
      }

      parsedExercises.push({
        id: newId(),
        name,
        sets,
      });
    }

    if (parsedExercises.length === 0) {
      Alert.alert('Add an exercise', 'Enter at least one exercise name and one complete set.');
      return null;
    }

    return { title: trimmedTitle, exercises: parsedExercises };
  };

  const onSave = () => {
    const parsed = parseWorkout();
    if (!parsed) {
      return;
    }

    void (async () => {
      await addLoggedWorkout({ title: parsed.title, exercises: parsed.exercises });
      setTitle('');
      setExercises([emptyExercise()]);
      router.replace('/');
    })();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      keyboardVerticalOffset={80}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Session name</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Push day"
          placeholderTextColor={colorScheme === 'dark' ? '#737373' : '#a3a3a3'}
          style={inputStyle}
        />

        {exercises.map((exercise, exIndex) => (
          <View key={exercise.clientId} style={[styles.card, { borderColor }]}>
            <Text style={styles.cardHeading}>Exercise {exIndex + 1}</Text>
            <TextInput
              value={exercise.name}
              onChangeText={(value) => updateExerciseName(exercise.clientId, value)}
              placeholder="Exercise name"
              placeholderTextColor={colorScheme === 'dark' ? '#737373' : '#a3a3a3'}
              style={inputStyle}
            />

            {exercise.sets.map((set, setIndex) => (
              <View key={set.clientId} style={styles.setRow}>
                <Text style={styles.setLabel}>Set {setIndex + 1}</Text>
                <TextInput
                  value={set.reps}
                  onChangeText={(value) => updateSet(exercise.clientId, set.clientId, 'reps', value)}
                  placeholder="Reps"
                  keyboardType="number-pad"
                  placeholderTextColor={colorScheme === 'dark' ? '#737373' : '#a3a3a3'}
                  style={[styles.input, styles.setInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
                />
                <TextInput
                  value={set.weightKg}
                  onChangeText={(value) => updateSet(exercise.clientId, set.clientId, 'weightKg', value)}
                  placeholder="kg"
                  keyboardType="decimal-pad"
                  placeholderTextColor={colorScheme === 'dark' ? '#737373' : '#a3a3a3'}
                  style={[styles.input, styles.setInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
                />
                {exercise.sets.length > 1 ? (
                  <Pressable onPress={() => removeSet(exercise.clientId, set.clientId)} hitSlop={6}>
                    <Text style={styles.linkDanger}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            <Pressable onPress={() => addSet(exercise.clientId)} style={styles.inlineAction}>
              <Text style={[styles.link, { color: Colors[colorScheme].tint }]}>Add set</Text>
            </Pressable>
          </View>
        ))}

        <Pressable onPress={addExercise} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonLabel, { color: Colors[colorScheme].tint }]}>
            Add another exercise
          </Text>
        </Pressable>

        <Pressable
          onPress={onSave}
          style={[styles.primaryButton, { backgroundColor: Colors[colorScheme].tint }]}>
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  setLabel: {
    width: 56,
    fontSize: 14,
    opacity: 0.75,
  },
  setInput: {
    flexGrow: 1,
    minWidth: 80,
  },
  link: {
    fontWeight: '600',
  },
  linkDanger: {
    color: '#ef4444',
    fontWeight: '600',
  },
  inlineAction: {
    alignSelf: 'flex-start',
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
