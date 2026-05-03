import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { DEFAULT_WORKOUT_ICON_ID, type WorkoutIconId } from '@/lib/workoutIcons';
import { DAYS_OF_WEEK, type DayOfWeek, type Workout, type WorkoutExercise } from '@/lib/types';
import { addWorkout } from '@/lib/workoutsStorage';

type DraftExercise = { clientId: string; name: string; sets: string; reps: string; weightKg: string };
type CopyWorkoutPayload = Pick<Workout, 'title' | 'dayOfWeek' | 'iconId'> & {
  exercises: Array<Pick<WorkoutExercise, 'name' | 'sets' | 'reps' | 'weightKg'>>;
};

function emptyExercise(): DraftExercise {
  return { clientId: newId(), name: '', sets: '', reps: '', weightKg: '' };
}

export default function LogWorkoutScreen() {
  const params = useLocalSearchParams<{ copyWorkout?: string | string[] }>();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';

  const [title, setTitle] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek | null>(null);
  const [isDayDropdownOpen, setIsDayDropdownOpen] = useState(false);
  const [iconId, setIconId] = useState<WorkoutIconId>(DEFAULT_WORKOUT_ICON_ID);
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()]);
  const lastAppliedCopyPayloadRef = useRef<string | null>(null);

  const inputStyle = [styles.input, { color: textColor, borderColor, backgroundColor: inputBackground }];

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
  const closeDayDropdown = () => {
    setIsDayDropdownOpen(false);
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
      if (!parsed.title || !parsed.dayOfWeek || !parsed.iconId || !Array.isArray(parsed.exercises)) {
        return;
      }

      setTitle(parsed.title);
      setDayOfWeek(parsed.dayOfWeek);
      setIconId(parsed.iconId);

      const mappedDrafts = parsed.exercises.map((ex) => ({
        clientId: newId(),
        name: ex.name,
        sets: String(ex.sets),
        reps: String(ex.reps),
        weightKg: String(ex.weightKg),
      }));
      setExercises(mappedDrafts.length > 0 ? mappedDrafts : [emptyExercise()]);

      lastAppliedCopyPayloadRef.current = raw;
    } catch {
      // Ignore malformed deep-link data and keep the current draft.
    }
  }, [params.copyWorkout]);

  const parseWorkout = (): Omit<Workout, 'id' | 'createdAt'> | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Give this session a short name (for example, “Upper body”).');
      return null;
    }
    if (!dayOfWeek) {
      Alert.alert('Choose a day', 'Select a day of the week for this workout.');
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
        id: newId(),
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

    return { title: trimmedTitle, dayOfWeek, iconId, exercises: parsedExercises };
  };

  const onSave = () => {
    const parsed = parseWorkout();
    if (!parsed) {
      return;
    }

    void (async () => {
      await addWorkout({
        title: parsed.title,
        dayOfWeek: parsed.dayOfWeek,
        iconId: parsed.iconId,
        exercises: parsed.exercises,
      });
      setTitle('');
      setDayOfWeek(null);
      setIconId(DEFAULT_WORKOUT_ICON_ID);
      setExercises([emptyExercise()]);
      router.replace('/');
    })();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.select({ ios: 'padding', android: 'height' })}
      keyboardVerticalOffset={Platform.select({ ios: 80, android: 24 })}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" onTouchStart={closeDayDropdown}>
        <Text style={styles.label}>Workout name</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Push day"
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
            <Text style={[styles.dropdownValue, { color: dayOfWeek ? textColor : activeScheme === 'dark' ? '#737373' : '#a3a3a3' }]}>
              {dayOfWeek ?? 'Select a day'}
            </Text>
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
                  style={[
                    styles.dropdownOption,
                    dayOfWeek === day && { backgroundColor: Colors[activeScheme].tint },
                  ]}>
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
                  style={[
                    styles.input,
                    styles.setInput,
                    styles.unitInput,
                    { color: textColor, borderColor, backgroundColor: inputBackground },
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
                  value={exercise.weightKg}
                  onChangeText={(value) => updateExerciseField(exercise.clientId, 'weightKg', value)}
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
          </View>
        ))}

        <Pressable onPress={addExercise} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonLabel, { color: Colors[activeScheme].tint }]}>
            Add another exercise
          </Text>
        </Pressable>

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
