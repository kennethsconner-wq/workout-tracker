import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { normalizeWorkoutIconId, type WorkoutIconId } from '@/lib/workoutIcons';
import { loadWorkouts } from '@/lib/workoutsStorage';
import { DAYS_OF_WEEK, type DayOfWeek, type WorkoutExercise } from '@/lib/types';

type RouteSource = 'create' | 'edit';
type ExerciseListItem = Pick<WorkoutExercise, 'id' | 'name' | 'sets' | 'reps' | 'weightKg'> & { key: string };
type ExerciseDraftSeed = { sourceExerciseId?: string; name: string; sets: string; reps: string; weightKg: string };
type CreateDraftPayload = { title: string; daysOfWeek: DayOfWeek[]; iconId: WorkoutIconId };
type ImportExercisesPayload = {
  nonce: string;
  exercises: ExerciseDraftSeed[];
  createDraft?: CreateDraftPayload;
};

function isDayOfWeekString(value: string): value is DayOfWeek {
  return (DAYS_OF_WEEK as readonly string[]).includes(value);
}

function parseCreateDraft(serialized: string | undefined): CreateDraftPayload | undefined {
  if (!serialized) {
    return undefined;
  }
  try {
    const raw = JSON.parse(serialized) as { title?: unknown; daysOfWeek?: unknown; iconId?: unknown };
    const title = typeof raw.title === 'string' ? raw.title : '';
    const daysOfWeek = Array.isArray(raw.daysOfWeek)
      ? raw.daysOfWeek.filter((day): day is DayOfWeek => typeof day === 'string' && isDayOfWeekString(day))
      : [];
    const iconId = normalizeWorkoutIconId(raw.iconId);
    return { title, daysOfWeek, iconId };
  } catch {
    return undefined;
  }
}

function parseExistingSeeds(serialized: string | undefined): ExerciseDraftSeed[] {
  if (!serialized) {
    return [];
  }
  try {
    const parsed = JSON.parse(serialized) as ExerciseDraftSeed[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ExerciseLibraryScreen() {
  const { source, workoutId, existingExercises, createDraft } = useLocalSearchParams<{
    source?: RouteSource;
    workoutId?: string | string[];
    existingExercises?: string | string[];
    createDraft?: string | string[];
  }>();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  /** Selected exercise ids (`WorkoutExercise.id`) for multi-select. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    void (async () => {
      const workouts = await loadWorkouts();
      const unique = new Map<string, ExerciseListItem>();
      for (const workout of workouts) {
        for (const exercise of workout.exercises) {
          const key = `${exercise.name}|${exercise.sets}|${exercise.reps}|${exercise.weightKg}`;
          if (!unique.has(key)) {
            unique.set(key, {
              key,
              id: exercise.id,
              name: exercise.name,
              sets: exercise.sets,
              reps: exercise.reps,
              weightKg: exercise.weightKg,
            });
          }
        }
      }
      setItems([...unique.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    })();
  }, []);

  const normalizedWorkoutId = useMemo(() => (Array.isArray(workoutId) ? workoutId[0] : workoutId), [workoutId]);
  const normalizedExistingExercises = useMemo(
    () => (Array.isArray(existingExercises) ? existingExercises[0] : existingExercises),
    [existingExercises],
  );

  const existingSeeds = useMemo(
    () => parseExistingSeeds(normalizedExistingExercises),
    [normalizedExistingExercises],
  );

  const normalizedCreateDraftJson = useMemo(
    () => (Array.isArray(createDraft) ? createDraft[0] : createDraft),
    [createDraft],
  );
  const preservedCreateDraft = useMemo(
    () => parseCreateDraft(normalizedCreateDraftJson),
    [normalizedCreateDraftJson],
  );

  const toggleSelection = useCallback((exerciseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  }, []);

  const addSelectedToWorkout = useCallback(() => {
    const byId = new Map(items.map((item) => [item.id, item]));
    const selected: ExerciseListItem[] = [];
    for (const exerciseId of selectedIds) {
      const found = byId.get(exerciseId);
      if (found) {
        selected.push(found);
      }
    }
    if (selected.length === 0) {
      return;
    }
    const nonce = String(Date.now());
    const newSeeds: ExerciseDraftSeed[] = selected.map((exercise) => ({
      sourceExerciseId: exercise.id,
      name: exercise.name,
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      weightKg: String(exercise.weightKg),
    }));
    const importPayload: ImportExercisesPayload = {
      nonce,
      exercises: [...existingSeeds, ...newSeeds],
      ...(source === 'create' && preservedCreateDraft ? { createDraft: preservedCreateDraft } : {}),
    };
    if (source === 'edit' && normalizedWorkoutId) {
      router.replace({
        pathname: '/workout-edit',
        params: { id: normalizedWorkoutId, importExercises: JSON.stringify(importPayload) },
      });
      return;
    }
    router.replace({
      pathname: '/workouts',
      params: { importExercises: JSON.stringify(importPayload) },
    });
  }, [existingSeeds, items, normalizedWorkoutId, preservedCreateDraft, selectedIds, source]);

  const selectedCount = selectedIds.size;
  const tint = Colors[activeScheme].tint;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          title: 'Exercise Library',
          headerRight: () =>
            selectedCount > 0 ? (
              <Pressable onPress={() => setSelectedIds(new Set())} style={styles.headerClear} hitSlop={12}>
                <Text style={[styles.headerClearLabel, { color: tint }]}>Clear</Text>
              </Pressable>
            ) : null,
        }}
      />
      {items.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No saved exercises found</Text>
          <Text style={styles.emptySubtitle}>Create a workout with at least one exercise first.</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={[styles.hint, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                Tap exercises to select them, then add them to your workout.
              </Text>
            }
            renderItem={({ item }) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <Pressable
                  onPress={() => toggleSelection(item.id)}
                  style={[
                    styles.card,
                    {
                      borderColor: isSelected ? tint : activeScheme === 'dark' ? '#333' : '#e5e5e5',
                      backgroundColor: isSelected
                        ? activeScheme === 'dark'
                          ? 'rgba(35, 213, 213, 0.12)'
                          : 'rgba(35, 213, 213, 0.08)'
                        : 'transparent',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}>
                  <View style={styles.cardText} lightColor="transparent" darkColor="transparent">
                    <Text style={styles.exerciseName}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {item.sets} set{item.sets === 1 ? '' : 's'} x {item.reps} reps @ {item.weightKg} lb
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
          <View
            style={[
              styles.footer,
              {
                borderTopColor: activeScheme === 'dark' ? '#333' : '#e5e5e5',
                backgroundColor: activeScheme === 'dark' ? '#0a0a0a' : '#fafafa',
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}>
            <Pressable
              onPress={addSelectedToWorkout}
              disabled={selectedCount === 0}
              style={[
                styles.addButton,
                selectedCount === 0 && styles.addButtonDisabled,
                { backgroundColor: selectedCount === 0 ? (activeScheme === 'dark' ? '#333' : '#d4d4d4') : tint },
              ]}>
              <Text
                style={[
                  styles.addButtonLabel,
                  selectedCount === 0 && { color: activeScheme === 'dark' ? '#a3a3a3' : '#525252' },
                ]}>
                {selectedCount === 0 ? 'Select exercises to add' : `Add ${selectedCount} exercise${selectedCount === 1 ? '' : 's'}`}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  headerClear: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 4,
  },
  headerClearLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 20,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
    gap: 10,
  },
  card: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
  },
  cardText: {
    gap: 4,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 14,
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    opacity: 0.75,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.85,
  },
  addButtonLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
