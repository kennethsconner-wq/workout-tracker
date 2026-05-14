import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  collectStoredExerciseOptions,
  countExerciseLoggedSessions,
  getExerciseLastLoggedAtIso,
  getExercisePersonalRecords,
  getLoggedExerciseExecutionSnapshots,
  getLoggedExerciseWeightSnapshots,
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

/** Y-axis tick formatter for weight-by-session chart (values match log weight fields shown as lb in the UI). */
function formatWeightTick(v: number): string {
  if (!Number.isFinite(v)) {
    return '';
  }
  const rounded = Math.round(v);
  if (Math.abs(v - rounded) < 1e-6) {
    return `${rounded} lb`;
  }
  return `${v.toFixed(1)} lb`;
}

const EXECUTION_SCORE_INFO_MESSAGE =
  'For each time this exercise appears in your log:\n\n' +
  '• Actual score = (average reps across sets) × (average weight across sets) × (number of sets logged)\n' +
  '• Planned score = planned sets × planned reps × planned weight from that session\n' +
  '• Execution for that entry = actual score ÷ planned score\n\n' +
  'The percentage shown is the average of those execution values across all logged entries. It can go above 100% if you beat the plan.';

const TOTAL_WEIGHT_MOVED_INFO_MESSAGE =
  'For every logged set of this exercise, we multiply reps × weight for that set, then add those amounts together for the whole session, then add across every workout where this exercise appears.';

const CHART_WEIGHT_EMPTY_MESSAGE =
  'Log this exercise on more days to plot weight. Each point is the average weight per set in that session (actual vs planned from your log).';

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
  const [visibleChartIndex, setVisibleChartIndex] = useState(0);

  const exerciseOptions = collectStoredExerciseOptions(workouts, logged);
  const selectedExercise = exerciseOptions.find((o) => o.id === selectedExerciseId) ?? null;
  const exerciseLoggedCount =
    selectedExerciseId !== null ? countExerciseLoggedSessions(logged, selectedExerciseId) : 0;
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
        label: 'Actual Score',
        color: Colors[activeScheme].tint,
        points: snaps.map((s) => ({
          score: s.actualScore,
          dateMs: new Date(s.createdAt).getTime(),
        })),
      },
      {
        id: 'planned-score',
        label: 'Planned Score',
        color: plannedLineColor,
        points: snaps.map((s) => ({
          score: s.plannedScore,
          dateMs: new Date(s.createdAt).getTime(),
        })),
      },
    ];
  }, [activeScheme, logged, selectedExerciseId]);
  const weightDateChartLines = useMemo((): ScoreDateLineSeries[] => {
    if (selectedExerciseId === null) {
      return [];
    }
    const snaps = getLoggedExerciseWeightSnapshots(logged, selectedExerciseId);
    const plannedLineColor = '#D40078';
    return [
      {
        id: 'actual-weight',
        label: 'Actual Weight',
        color: Colors[activeScheme].tint,
        points: snaps.map((s) => ({
          score: s.avgActualWeightKg,
          dateMs: new Date(s.createdAt).getTime(),
        })),
      },
      {
        id: 'planned-weight',
        label: 'Planned Weight',
        color: plannedLineColor,
        points: snaps.map((s) => ({
          score: s.plannedWeightKg,
          dateMs: new Date(s.createdAt).getTime(),
        })),
      },
    ];
  }, [activeScheme, logged, selectedExerciseId]);
  const scrollInnerWidth = Math.max(0, windowWidth - 32);
  const chartCarouselSlideWidth = scrollInnerWidth;
  const chartPlotWidth = Math.max(160, chartCarouselSlideWidth - 28);

  const metricCharts = useMemo(
    () => [
      {
        key: 'weight' as const,
        title: 'Weight By Session',
        lines: weightDateChartLines,
        yAxisLabel: 'Weight',
        formatYTick: formatWeightTick,
        emptyMessage: CHART_WEIGHT_EMPTY_MESSAGE,
        chartAccessibilityLabel: 'Weight by session chart',
      },
      {
        key: 'execution' as const,
        title: 'Execution Score By Session',
        lines: scoreDateChartLines,
        yAxisLabel: 'Score',
        formatYTick: undefined as ((v: number) => string) | undefined,
        emptyMessage: undefined as string | undefined,
        chartAccessibilityLabel: 'Execution score by session chart',
      },
    ],
    [scoreDateChartLines, weightDateChartLines],
  );

  const chartCarouselScrollable = metricCharts.length > 1;
  const chartCarouselRef = useRef<FlatList<(typeof metricCharts)[number]>>(null);

  const onChartViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const idx = viewableItems[0]?.index;
      if (idx != null) {
        setVisibleChartIndex(idx);
      }
    },
    [],
  );
  const chartViewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 55 }),
    [],
  );

  useEffect(() => {
    setVisibleChartIndex(0);
    chartCarouselRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [selectedExerciseId]);

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
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exercise for metrics"
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            styles.dropdown,
            { borderColor, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Text style={[styles.dropdownText, styles.dropdownTextMagenta]} numberOfLines={1}>
            {selectedExercise?.name ?? 'Select'}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#D40078" />
        </Pressable>

        {selectedExerciseId !== null ? (
          <>
          <View style={[styles.metricsCard, { borderColor }]}>
            <View style={styles.metricRow}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Times Logged
                </Text>
              </View>
              <Text style={styles.metricValue}>{exerciseLoggedCount}</Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Execution Score
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="How Execution Score is calculated"
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Execution Score', EXECUTION_SCORE_INFO_MESSAGE, [{ text: 'OK' }])
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
              </View>
              <Text style={styles.metricValue}>{formatPrWeightLb(personalRecords?.maxWeight ?? null)}</Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Personal Record, Reps
                </Text>
              </View>
              <Text style={styles.metricValue}>{formatPrInt(personalRecords?.maxReps ?? null)}</Text>
            </View>
            <View style={[styles.metricRow, styles.metricRowDivider, { borderTopColor: borderColor }]}>
              <View style={styles.metricLabelWithInfo}>
                <Text style={styles.metricTitleText} numberOfLines={2}>
                  Personal Record, Sets
                </Text>
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
              </View>
              <Text style={[styles.metricValue, styles.metricValueDate]} numberOfLines={2}>
                {formatLastLoggedDisplay(lastLoggedIso)}
              </Text>
            </View>
          </View>
          <View style={[styles.chartCarouselOuter, { width: chartCarouselSlideWidth }]}>
            {chartCarouselScrollable ? (
              <View
                style={styles.chartScrollHintRow}
                accessible
                accessibilityLabel="Swipe sideways to see both charts">
                <Ionicons
                  name="swap-horizontal"
                  size={16}
                  color={textColor}
                  style={styles.chartScrollHintIcon}
                />
              </View>
            ) : null}
            <FlatList
              ref={chartCarouselRef}
              data={metricCharts}
              keyExtractor={(item) => item.key}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator
              nestedScrollEnabled
              style={{ width: chartCarouselSlideWidth }}
              snapToInterval={chartCarouselSlideWidth}
              snapToAlignment="start"
              decelerationRate="fast"
              viewabilityConfig={chartViewabilityConfig}
              onViewableItemsChanged={onChartViewableItemsChanged}
              getItemLayout={(_, index) => ({
                length: chartCarouselSlideWidth,
                offset: chartCarouselSlideWidth * index,
                index,
              })}
              renderItem={({ item }) => (
                <View style={{ width: chartCarouselSlideWidth }}>
                  <View style={[styles.chartCard, { borderColor, width: chartCarouselSlideWidth }]}>
                    <Text style={styles.chartCardTitle}>{item.title}</Text>
                    <ScoreDateLineChart
                      width={chartPlotWidth}
                      lines={item.lines}
                      axisColor={borderColor}
                      labelColor={activeScheme === 'dark' ? '#a3a3a3' : '#525252'}
                      yAxisLabel={item.yAxisLabel}
                      {...(item.formatYTick ? { formatYTick: item.formatYTick } : {})}
                      {...(item.emptyMessage ? { emptyMessage: item.emptyMessage } : {})}
                      chartAccessibilityLabel={item.chartAccessibilityLabel}
                    />
                  </View>
                </View>
              )}
            />
            {chartCarouselScrollable ? (
              <View
                style={styles.chartPageDots}
                accessibilityLabel={`Chart ${visibleChartIndex + 1} of ${metricCharts.length}`}>
                {metricCharts.map((c, index) => (
                  <View
                    key={c.key}
                    style={[
                      styles.chartPageDot,
                      {
                        backgroundColor:
                          index === visibleChartIndex
                            ? Colors[activeScheme].tint
                            : activeScheme === 'dark'
                              ? 'rgba(255,255,255,0.22)'
                              : 'rgba(0,0,0,0.18)',
                      },
                      index === visibleChartIndex ? styles.chartPageDotActive : null,
                    ]}
                  />
                ))}
              </View>
            ) : null}
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
                backgroundColor: Colors[activeScheme].background,
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
              contentContainerStyle={{ paddingBottom: Math.max(12, insets.bottom) }}
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
                  <Text style={[styles.optionText, styles.dropdownTextMagenta]} numberOfLines={2}>
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
  dropdownTextMagenta: {
    color: '#D40078',
  },
  metricsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  chartCarouselOuter: {
    marginTop: 4,
  },
  chartScrollHintRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  chartScrollHintIcon: {
    opacity: 0.55,
  },
  chartPageDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  chartPageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chartPageDotActive: {
    width: 18,
    borderRadius: 4,
  },
  chartCard: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    paddingBottom: 12,
    gap: 8,
  },
  chartCardTitle: {
    fontSize: 17,
    fontWeight: '700',
    alignSelf: 'stretch',
    textAlign: 'center',
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
