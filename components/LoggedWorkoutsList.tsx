import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { deleteLoggedWorkout, loadLoggedWorkouts } from '@/lib/workoutsStorage';
import type { LoggedWorkout } from '@/lib/types';

export function LoggedWorkoutsList() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const router = useRouter();
  const [workouts, setWorkouts] = useState<LoggedWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const next = await loadLoggedWorkouts();
        if (!cancelled) {
          setWorkouts(next);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const onDelete = (workout: LoggedWorkout) => {
    Alert.alert('Delete workout?', `Remove “${workout.title}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteLoggedWorkout(workout.id);
            setWorkouts(await loadLoggedWorkouts());
          })();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors[activeScheme].tint} />
      </View>
    );
  }

  if (workouts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No workouts yet</Text>
        <Text style={styles.emptySubtitle}>
          Open the Log workout tab to record your first session. Everything stays on this device.
        </Text>
        <Pressable
          style={[styles.cta, { backgroundColor: Colors[activeScheme].tint }]}
          onPress={() => router.push('/add')}>
          <Text style={styles.ctaLabel}>Log a workout</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={workouts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={[styles.card, { borderColor: colorScheme === 'dark' ? '#333' : '#e5e5e5' }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Pressable onPress={() => onDelete(item)} hitSlop={8}>
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
          <Text style={styles.meta}>
            {new Date(item.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Text>
          <Text style={styles.meta}>
            {item.exercises.length} exercise{item.exercises.length === 1 ? '' : 's'}
          </Text>
          {item.exercises.map((ex) => (
            <View key={ex.id} style={styles.exerciseBlock}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              {ex.sets.map((set, idx) => (
                <Text key={`${ex.id}-${idx}`} style={styles.setLine}>
                  Set {idx + 1}: {set.reps} reps @ {set.weightKg} kg
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.75,
    lineHeight: 22,
  },
  cta: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaLabel: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  delete: {
    color: '#ef4444',
    fontWeight: '600',
  },
  meta: {
    fontSize: 14,
    opacity: 0.7,
  },
  exerciseBlock: {
    marginTop: 8,
    gap: 2,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  setLine: {
    fontSize: 14,
    opacity: 0.85,
  },
});
