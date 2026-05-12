import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScoreDateLineChart, type ScoreDateLineSeries } from '@/components/ScoreDateLineChart';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  averageExerciseExecutionScorePercent,
  exerciseCompletionScorePercent,
  collectStoredExerciseOptions,
  countExerciseLoggedSessions,
  getExerciseLastLoggedAtIso,
  getExercisePersonalRecords,
  getLoggedExerciseExecutionSnapshots,
  getTotalWeightMovedForExercise,
} from '@/lib/exerciseSnapshot';
import { loadLoggedWorkouts, loadWorkouts } from '@/lib/workoutsStorage';
import type { LoggedWorkout, Workout } from '@/lib/types';

function formatPrWeightLb(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const rounded = Math.round(value);
  const text = Math.abs(value - rounded) < 1e-6 ? String(rounded) : value.toFixed(1);
  return `${text} lb`;
}

function formatPrInt(value: number | null): string {
  return value === null ? '—' : String(value);
}

function formatLastLoggedDisplay(iso: string | null): string {
  if (iso === null) {
    return '—';
  }
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) {
    return '—';
  }
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatTotalWeightMoved(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const hasFraction = Math.abs(value % 1) > 1e-9;
  const num = value.toLocaleString(undefined, {
    maximumFractionDigits: hasFraction ? 1 : 0,
    minimumFractionDigits: 0,
  });
  return `${num} lb`;
}

const EXERCISE_LOGGED_INFO_MESSAGE =
  'This number counts how many workout sessions in your log include this exercise at least once.\n\n' +
  'Each saved log (from Log Workout) counts as one session. If you did the exercise in that session, it adds 1—even if you logged multiple sets. Sessions where this exercise does not appear are not counted.';

const EXERCISE_COMPLETION_SCORE_INFO_MESSAGE =
  'We take the number of logs that include this exercise (the same count as Exercise Logged) and divide by the total number of logs for every workout that currently plans this exercise on the Create tab.\n\n' +
  'Example: if this lift is only on “Upper Body”, the denominator is how many Upper Body sessions you have logged—whether or not that session included this lift. If two workouts plan it, we add each workout’s log counts together for the denominator.\n\n' +
  'The result is shown as a percentage. It can exceed 100% if older logs still contain this exercise after you removed it from a template, or in similar edge cases.';

const LAST_LOGGED_INFO_MESSAGE =
  'The calendar date of the most recent workout log that includes this exercise.\n\n' +
  'It uses the same sessions as Exercise Logged: whenever you save a log that contains this lift, that session’s date can become the new “last logged” if it is the newest.';

const EXECUTION_SCORE_INFO_MESSAGE =
  'For each time this exercise appears in your log:\n\n' +
  '• Actual score = (average reps across sets) × (average weight across sets) × (number of sets logged)\n' +
  '• Planned score = planned sets × planned reps × planned weight from that session\n' +
  '• Execution for that entry = actual score ÷ planned score\n\n' +
  'The percentage shown is the average of those execution values across all logged entries. It can go above 100% if you beat the plan.';

const PR_WEIGHT_INFO_MESSAGE =
  'The heaviest weight you logged on a single set for this exercise, across every workout session.\n\n' +
  'Only sets saved in your log count. If you logged the same exercise on different days, we take the maximum weight from any one set.';

const PR_REPS_INFO_MESSAGE =
  'The most repetitions you logged on a single set for this exercise, across every workout session.\n\n' +
  'We look at each set’s rep count and take the highest value. It does not add reps across multiple sets in the same session.';

const PR_SETS_INFO_MESSAGE =
  'The most sets you logged in one session for this exercise.\n\n' +
  'For each workout log that includes this exercise, we count how many sets you entered. The number shown is the largest of those counts—not the total sets ever logged across all time.';

const TOTAL_WEIGHT_MOVED_INFO_MESSAGE =
  'For every logged set of this exercise, we multiply reps × weight for that set, then add those amounts together for the whole session, then add across every workout where this exercise appears.';

/** Metrics tab: exercise-specific snapshot (full history is on the Log tab). */
export function LoggedWorkoutsList() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const borderColor = activeScheme === 'dark' ? '#333' : '#e5e5e5';
  const textColor = Colors[activeScheme].text;

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [logged, setLogged] = useState<LoggedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const exerciseOptions = collectStoredExerciseOptions(workouts, logged);
  const selectedExercise = exerciseOptions.find((o) => o.id === selectedExerciseId) ?? null;
  const exerciseLoggedCount =
    selectedExerciseId !== null ? countExerciseLoggedSessions(logged, selectedExerciseId) : 0;
  const completionScorePercent = useMemo(
    () =>
      selectedExerciseId !== null
        ? exerciseCompletionScorePercent(workouts, logged, selectedExerciseId)
        : null,
    [logged, selectedExerciseId, workouts],
  );
  const executionScorePercent = useMemo(
    () =>
      selectedExerciseId !== null ? averageExerciseExecutionScorePercent(logged, selectedExerciseId) : null,
    [logged, selectedExerciseId],
  );
  const personalRecords = useMemo(
    () => (selectedExerciseId !== null ? getExercisePersonalRecords(logged, selectedExerciseId) : null),
    [logged, selectedExerciseId],
  );
  const lastLoggedIso = useMemo(
    () => (selectedExerciseId !== null ? getExerciseLastLoggedAtIso(logged, selectedExerciseId) : null),
    [logged, selectedExerciseId],
  );
  const totalWeightMoved = useMemo(
    () => (selectedExerciseId !== null ? getTotalWeightMovedForExercise(logged, selectedExerciseId) : 0),
    [logged, selectedExerciseId],
  );
  const scoreDateChartLines = useMemo((): ScoreDateLineSeries[] => {
    if (selectedExerciseId === null) {
      return [];
    }
    const snaps = getLoggedExerciseExecutionSnapshots(logged, selectedExerciseId);
    /** Same as workout title on Workouts (`WorkoutsList` `dropdownTextMagenta`). */
    const plannedLineColor = '#D40078';
    return [
      {
        id: 'actual-score',
        label: 'LoggedExerciseActualScore',
        color: Colors[activeScheme].tint,
        points: snaps.map((s) => ({
          score: s.actualScore,
          dateMs: new Date(s.createdAt).getTime(),
        })),
      },
      {
        id: 'planned-score',
        label: 'LoggedExercisePlannedScore',
        color: plannedLineColor,
        points: snaps.map((s) => ({
          score: s.plannedScore,
          dateMs: new Date(s.createdAt).getTime(),
        })),
      },
    ];
  }, [activeScheme, logged, selectedExerciseId]);
  const scrollInnerWidth = Math.max(0, windowWidth - 32);
  /** Slightly narrower than the scroll area so the card isn’t flush to the right edge. */
  const chartCardWidth = Math.max(0, scrollInnerWidth - 16);
  /** Plot width inside the card’s horizontal padding (14 + 14). */
  const chartPlotWidth = Math.max(160, chartCardWidth - 28);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [nextWorkouts, nextLogged] = await Promise.all([loadWorkouts(), loadLoggedWorkouts()]);
        if (cancelled) {
          return;
        }
        const options = collectStoredExerciseOptions(nextWorkouts, nextLogged);
        setWorkouts(nextWorkouts);
        setLogged(nextLogged);
        setSelectedExerciseId((prev) => {
          if (prev && options.some((o) => o.id === prev)) {
            return prev;
          }
          return options[0]?.id ?? null;
        });
        setLoading(false);
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

  if (exerciseOptions.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No exercises yet</Text>
        <Text style={styles.emptySubtitle}>
          Add exercises to a workout on the Create tab. After you log sessions, metrics for each exercise appear here.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.fieldLabel}>Exercise</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            styles.dropdown,
            { borderColor, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.dropdownText, { color: textColor }]} numberOfLines={1}>
            {selectedExercise?.name ?? 'Select'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={textColor} />
        </Pressable>

        {selectedExerciseId !== null ? (
          <>
          <View style={[styles.metricsCard, { borderColor }]}>
            <View style={styles.metricRow}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Exercise Logged
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Exercise Logged is calculated"
                  hitSlop={10}
                  onPress={() => Alert.alert('Exercise Logged', EXERCISE_LOGGED_INFO_MESSAGE, [{ text: 'OK' }])}
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={styles.metricValue}>{exerciseLoggedCount}</Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Exercise Completion Score
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Exercise Completion Score is calculated"
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Exercise Completion Score', EXERCISE_COMPLETION_SCORE_INFO_MESSAGE, [
                      { text: 'OK' },
                    ])
                  }
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={styles.metricValue}>
                {completionScorePercent !== null ? `${completionScorePercent.toFixed(0)}%` : '—'}
              </Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Exercise Execution Score
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Exercise Execution Score is calculated"
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Exercise Execution Score', EXECUTION_SCORE_INFO_MESSAGE, [{ text: 'OK' }])
                  }
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={styles.metricValue}>
                {executionScorePercent !== null ? `${executionScorePercent.toFixed(0)}%` : '—'}
              </Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Personal Record, Weight
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Personal Record Weight is calculated"
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Personal Record, Weight', PR_WEIGHT_INFO_MESSAGE, [{ text: 'OK' }])
                  }
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={styles.metricValue}>{formatPrWeightLb(personalRecords?.maxWeight ?? null)}</Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Personal Record, Reps
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Personal Record Reps is calculated"
                  hitSlop={10}
                  onPress={() => Alert.alert('Personal Record, Reps', PR_REPS_INFO_MESSAGE, [{ text: 'OK' }])}
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={styles.metricValue}>{formatPrInt(personalRecords?.maxReps ?? null)}</Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Personal Record, Sets
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Personal Record Sets is calculated"
                  hitSlop={10}
                  onPress={() => Alert.alert('Personal Record, Sets', PR_SETS_INFO_MESSAGE, [{ text: 'OK' }])}
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={styles.metricValue}>{formatPrInt(personalRecords?.maxSets ?? null)}</Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Total Weight Moved
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Total Weight Moved is calculated"
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Total Weight Moved', TOTAL_WEIGHT_MOVED_INFO_MESSAGE, [{ text: 'OK' }])
                  }
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={[styles.metricValue, styles.metricValueDate]} numberOfLines={2}>
                {formatTotalWeightMoved(totalWeightMoved)}
              </Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Last Logged
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Last Logged is determined"
                  hitSlop={10}
                  onPress={() => Alert.alert('Last Logged', LAST_LOGGED_INFO_MESSAGE, [{ text: 'OK' }])}
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              </View>
              <Text style={[styles.metricValue, styles.metricValueDate]} numberOfLines={2}>
                {formatLastLoggedDisplay(lastLoggedIso)}
              </Text>
            </View>
          </View>
          <View style={[styles.chartCard, { borderColor, width: chartCardWidth }]}>
            <Text style={styles.chartCardTitle}>Execution Score By Session</Text>
            <Text style={styles.chartCardSubtitle}>
              {
                'Horizontal: session date\nVertical: LoggedExerciseActualScore & LoggedExercisePlannedScore (same formulas as Exercise Execution Score)'
              }
            </Text>
            <ScoreDateLineChart
              width={chartPlotWidth}
              lines={scoreDateChartLines}
              axisColor={borderColor}
              labelColor={activeScheme === 'dark' ? '#a3a3a3' : '#525252'}
            />
          </View>
          </>
        ) : null}
      </ScrollView>

      <Modal visible={pickerOpen} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                borderColor,
                backgroundColor: activeScheme === 'dark' ? '#1a1a1a' : '#fff',
                paddingBottom: 12 + insets.bottom,
              },
            ]}
            onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select exercise</Text>
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => setPickerOpen(false)}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <Ionicons name="close" size={26} color={textColor} />
              </Pressable>
            </View>
            <FlatList
              data={exerciseOptions}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.optionRow,
                    { borderBottomColor: borderColor, opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => {
                    setSelectedExerciseId(item.id);
                    setPickerOpen(false);
                  }}>
                  <Text style={[styles.optionText, { color: textColor }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.id === selectedExerciseId ? (
                    <Ionicons name="checkmark" size={22} color={Colors[activeScheme].tint} />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
  },
  metricsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  chartCard: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    paddingBottom: 12,
    gap: 8,
    marginTop: 4,
  },
  chartCardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  chartCardSubtitle: {
    fontSize: 13,
    opacity: 0.72,
    lineHeight: 18,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricRowDivider: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metricTitleText: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  metricLabelWithInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    minWidth: 0,
    paddingRight: 8,
  },
  metricInfoIconPressable: {
    flexShrink: 0,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  metricValueDate: {
    fontSize: 15,
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
});
