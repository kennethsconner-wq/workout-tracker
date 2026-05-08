import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getExercisePR, getExerciseTrend, getWorkoutSummary } from '@/lib/loggedWorkoutAnalytics';
import { loadLoggedWorkouts } from '@/lib/workoutsStorage';
import type { LoggedWorkout } from '@/lib/types';

/** Metrics tab: progress snapshot only (full history is on the Log tab). */
export function LoggedWorkoutsList() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const [workouts, setWorkouts] = useState<LoggedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const latestWorkoutId = workouts[0]?.workoutId ?? null;
  const latestWorkoutTitle = workouts[0]?.title ?? null;
  const workoutSummary = useMemo(
    () => (latestWorkoutId ? getWorkoutSummary(workouts, latestWorkoutId) : null),
    [latestWorkoutId, workouts],
  );
  const workoutExerciseAnalytics = useMemo(() => {
    if (!latestWorkoutId) {
      return [];
    }
    const exerciseIds = new Set<string>();
    for (const log of workouts) {
      if (log.workoutId !== latestWorkoutId) {
        continue;
      }
      for (const exercise of log.exercises) {
        exerciseIds.add(exercise.workoutExerciseId);
      }
    }
    return [...exerciseIds]
      .map((exerciseId) => {
        const trend = getExerciseTrend(workouts, exerciseId);
        const pr = getExercisePR(workouts, exerciseId);
        const last = trend[trend.length - 1];
        const prev = trend[trend.length - 2];
        return {
          exerciseId,
          name: last?.exerciseName ?? 'Exercise',
          pr,
          lastWeight: last?.actualWeightKg ?? 0,
          deltaWeight: last && prev ? last.actualWeightKg - prev.actualWeightKg : 0,
          sessions: trend.length,
        };
      })
      .filter((item) => item.pr)
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
      .slice(0, 3);
  }, [latestWorkoutId, workouts]);

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
          Open a workout and use Log Workout to record your first session. Full history lives on the Log tab.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {workoutSummary && latestWorkoutTitle ? (
        <View style={[styles.analyticsCard, { borderColor: colorScheme === 'dark' ? '#333' : '#e5e5e5' }]}>
          <Text style={styles.analyticsTitle}>Progress snapshot: {latestWorkoutTitle}</Text>
          <Text style={styles.meta}>Sessions logged: {workoutSummary.sessions}</Text>
          <Text style={styles.meta}>Average completion: {(workoutSummary.avgCompletionRate * 100).toFixed(0)}%</Text>
          {workoutSummary.lastLoggedAt ? (
            <Text style={styles.meta}>
              Last session:{' '}
              {new Date(workoutSummary.lastLoggedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          ) : null}
          {workoutExerciseAnalytics.map((item) => (
            <View key={item.exerciseId} style={styles.exerciseBlock}>
              <Text style={styles.exerciseName}>{item.name}</Text>
              <Text style={styles.setLine}>
                Last weight: {item.lastWeight} lb ({item.deltaWeight >= 0 ? '+' : ''}
                {item.deltaWeight.toFixed(1)} vs prev)
              </Text>
              <Text style={styles.setLine}>
                PRs: {item.pr?.bestWeightKg} lb | {item.pr?.bestReps} reps | {item.pr?.bestVolume.toFixed(1)} volume
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
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
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  analyticsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '700',
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
