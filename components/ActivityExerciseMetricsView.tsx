import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { ScoreDateLineChart, type ScoreDateLineSeries } from '@/components/ScoreDateLineChart';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { ActivityType } from '@/lib/activityTypes';
import {
  averageActivityExecutionScorePercent,
  formatCardioPacePr,
  formatCardioPrDistance,
  formatDurationPr,
  formatSportScorePr,
  getActivityExecutionSnapshots,
  getCardioDistanceSnapshots,
  getCardioDurationSnapshots,
  getCardioPaceSnapshots,
  getCardioLifetimeDistance,
  getCardioPersonalRecords,
  cardioPlanReferenceExercise,
  getSportDurationSnapshots,
  getSportPersonalRecords,
  getSportScoreSnapshots,
  getStretchLifetimeDuration,
  getStretchPersonalRecords,
  getStretchTotalDurationSnapshots,
  latestLoggedExercise,
  cardioMetricDisplayDistanceUnit,
  type SessionValueSnapshot,
} from '@/lib/activityExerciseMetrics';
import { DISPLAY_DECIMAL_PLACES, formatDisplayDecimal } from '@/lib/displayDecimals';
import { formatCardioDistanceWithUnit } from '@/lib/cardioDistanceUnits';
import {
  cardioExerciseShowsDistanceChart,
  cardioExerciseShowsDurationChart,
  cardioExerciseShowsPaceChart,
  formatCardioPaceSummary,
  readCardioPacePlan,
} from '@/lib/cardioPlan';
import { formatDurationWithUnit } from '@/lib/durationUnits';
import { SCORE_UNIT_ABBREVIATIONS } from '@/lib/scoreUnits';
import type { StoredExerciseMetricTarget } from '@/lib/exerciseSnapshot';
import {
  averageExerciseExecutionScorePercent,
  getExercisePersonalRecords,
  getLoggedExerciseExecutionSnapshots,
  getLoggedExerciseWeightSnapshots,
  getTotalWeightMovedForExercise,
} from '@/lib/exerciseSnapshot';
import { themedAlert } from '@/lib/themedAlert';
import type { LoggedWorkout, LoggedWorkoutExercise, Workout } from '@/lib/types';
import { formatWeightWithUnit } from '@/lib/weightUnits';

type MetricChartConfig = {
  key: string;
  title: string;
  lines: ScoreDateLineSeries[];
  yAxisLabel: string;
  formatYTick?: (value: number) => string;
  emptyMessage?: string;
  chartAccessibilityLabel: string;
};

type Props = {
  activityType: ActivityType;
  logged: LoggedWorkout[];
  workouts: Workout[];
  metricTarget: StoredExerciseMetricTarget;
  exerciseLoggedCount: number;
  lastLoggedIso: string | null;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  textColor: string;
  chartCarouselSlideWidth: number;
  chartPlotWidth: number;
};

const EXECUTION_SCORE_INFO_MESSAGE =
  'For each time this exercise appears in your log (including duplicate slots in the same workout):\n\n' +
  '• Actual score = (average reps across sets) × (average weight across sets) × (number of sets logged)\n' +
  '• Planned score = planned sets × planned reps × planned weight from that session\n' +
  '• Execution for that entry = actual score ÷ planned score\n\n' +
  'The percentage shown is the average of those execution values across all logged appearances. It can go above 100% if you beat the plan.';

const TOTAL_WEIGHT_MOVED_INFO_MESSAGE =
  'For every logged set of this exercise, we multiply reps × weight for that set, then add those amounts together for the whole session, then add across every workout where this exercise appears.';

const CHART_EXECUTION_EMPTY_MESSAGE =
  'Log this exercise on more days to plot execution score. Each point is actual ÷ planned for that session.';

const CHART_WEIGHT_EMPTY_MESSAGE =
  'Log this exercise on more days to plot weight. Each point is the average weight per set in that session.';

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

function formatPrInt(value: number | null): string {
  return value === null ? '—' : String(value);
}

function buildValueChartLines(
  snapshots: SessionValueSnapshot[],
  activeScheme: 'light' | 'dark',
  label: string,
): ScoreDateLineSeries[] {
  return [
    {
      id: 'actual',
      label,
      color: Colors[activeScheme].tint,
      points: snapshots.map((snapshot) => ({
        score: snapshot.actual,
        dateMs: new Date(snapshot.createdAt).getTime(),
      })),
    },
  ];
}

function formatPrWeightLb(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return formatWeightWithUnit(value, 'pounds');
}

function formatTotalWeightMoved(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  const hasFraction = Math.abs(value % 1) > 1e-9;
  const num = value.toLocaleString(undefined, {
    maximumFractionDigits: hasFraction ? DISPLAY_DECIMAL_PLACES : 0,
    minimumFractionDigits: 0,
  });
  return `${num} lb`;
}

function formatWeightTick(v: number): string {
  if (!Number.isFinite(v)) {
    return '';
  }
  return formatWeightWithUnit(v, 'pounds');
}

function getExecutionSnapshotsForCharts(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activityType: ActivityType,
): Array<{ createdAt: string; executionRatio: number }> {
  if (activityType === 'strength') {
    return getLoggedExerciseExecutionSnapshots(logged, target);
  }
  return getActivityExecutionSnapshots(logged, target, activityType);
}

function buildExecutionChartLines(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activityType: ActivityType,
  activeScheme: 'light' | 'dark',
): ScoreDateLineSeries[] {
  const snapshots = getExecutionSnapshotsForCharts(logged, target, activityType);
  return [
    {
      id: 'execution',
      label: 'Execution %',
      color: Colors[activeScheme].tint,
      points: snapshots.map((snapshot) => ({
        score: snapshot.executionRatio * 100,
        dateMs: new Date(snapshot.createdAt).getTime(),
      })),
    },
  ];
}

function executionChartConfig(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activityType: ActivityType,
  activeScheme: 'light' | 'dark',
): MetricChartConfig {
  return {
    key: 'execution',
    title: 'Execution Score By Session',
    lines: buildExecutionChartLines(logged, target, activityType, activeScheme),
    yAxisLabel: 'Execution %',
    formatYTick: (value) => `${Math.round(value)}%`,
    emptyMessage: CHART_EXECUTION_EMPTY_MESSAGE,
    chartAccessibilityLabel: 'Execution score by session chart',
  };
}

function cardioMetricsConfig(
  logged: LoggedWorkout[],
  workouts: Workout[],
  target: StoredExerciseMetricTarget,
  activeScheme: 'light' | 'dark',
): { charts: MetricChartConfig[]; infoMessages: Record<string, string> } {
  const planReference = cardioPlanReferenceExercise(workouts, logged, target);
  const latest = latestLoggedExercise(logged, target);
  const displayReference = (latest ?? planReference) as LoggedWorkoutExercise | null;
  const distanceSnapshots = getCardioDistanceSnapshots(logged, target);
  const durationSnapshots = getCardioDurationSnapshots(logged, target);
  const paceSnapshots = getCardioPaceSnapshots(logged, target);
  const distanceUnit = cardioMetricDisplayDistanceUnit(displayReference);
  const durationUnit = displayReference?.actualDurationUnit ?? displayReference?.durationUnit ?? 'minutes';
  const pacePlan = planReference ? readCardioPacePlan({ ...planReference, activityType: 'cardio' }) : null;

  const formatDistanceTick = (value: number) => formatCardioDistanceWithUnit(value, distanceUnit) || '';
  const formatDurationTick = (value: number) => formatDurationWithUnit(value, durationUnit) || '';
  const formatPaceTick = (value: number) => {
    if (pacePlan) {
      return (
        formatCardioPaceSummary({
          duration: value,
          durationUnit: pacePlan.durationUnit,
          distance: pacePlan.distance,
          distanceUnit: pacePlan.distanceUnit,
        }) || ''
      );
    }
    return formatDurationWithUnit(value, durationUnit) || '';
  };

  const charts: MetricChartConfig[] = [];
  if (cardioExerciseShowsDistanceChart(planReference)) {
    charts.push({
      key: 'distance',
      title: 'Distance By Session',
      lines: buildValueChartLines(distanceSnapshots, activeScheme, 'Distance'),
      yAxisLabel: 'Distance',
      formatYTick: formatDistanceTick,
      emptyMessage:
        'Log this exercise on more days to plot distance. Each point is logged distance for that session.',
      chartAccessibilityLabel: 'Distance by session chart',
    });
  }
  if (cardioExerciseShowsDurationChart(planReference)) {
    charts.push({
      key: 'duration',
      title: 'Duration By Session',
      lines: buildValueChartLines(durationSnapshots, activeScheme, 'Duration'),
      yAxisLabel: 'Duration',
      formatYTick: formatDurationTick,
      emptyMessage:
        'Log this exercise on more days to plot duration. Each point is logged duration for that session.',
      chartAccessibilityLabel: 'Duration by session chart',
    });
  }
  if (cardioExerciseShowsPaceChart(planReference)) {
    charts.push({
      key: 'pace',
      title: 'Average Pace By Session',
      lines: buildValueChartLines(paceSnapshots, activeScheme, 'Average Pace'),
      yAxisLabel: 'Pace',
      formatYTick: formatPaceTick,
      emptyMessage:
        'Log this exercise on more days to plot average pace. Each point is your average time per planned pace chunk for that session.',
      chartAccessibilityLabel: 'Average pace by session chart',
    });
  }
  charts.push(executionChartConfig(logged, target, 'cardio', activeScheme));

  return {
    charts,
    infoMessages: {
      execution:
        'For each logged appearance of this exercise (duplicate slots in one workout each count separately), execution compares what you logged against the plan:\n\n' +
        '• Objective-only: actual ÷ planned for the tracked field (distance or duration)\n' +
        '• Track total duration and distance: 50% (actual objective ÷ planned objective) + 50% (actual pace ÷ planned pace)\n' +
        '• Track duration/distance per unit: 50% (actual objective ÷ planned objective) + 50% (average of actual pace ÷ planned pace for each logged segment)\n\n' +
        'Pace is distance ÷ duration. The percentage shown is the average of those scores across all logged appearances (duplicate slots in one workout each count separately). Values above 100% mean you beat the plan.',
    },
  };
}

function sportMetricsConfig(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activeScheme: 'light' | 'dark',
): { charts: MetricChartConfig[]; infoMessages: Record<string, string> } {
  const latest = latestLoggedExercise(logged, target);
  const durationSnapshots = getSportDurationSnapshots(logged, target);
  const scoreSnapshots = getSportScoreSnapshots(logged, target);
  const durationUnit = latest?.actualDurationUnit ?? latest?.durationUnit ?? 'minutes';
  const scoreUnit = latest?.actualScoreUnit ?? latest?.scoreUnit ?? 'points';

  const charts: MetricChartConfig[] = [];
  if (durationSnapshots.length > 0) {
    charts.push({
      key: 'duration',
      title: 'Duration By Session',
      lines: buildValueChartLines(durationSnapshots, activeScheme, 'Duration'),
      yAxisLabel: 'Duration',
      formatYTick: (value) => formatDurationWithUnit(value, durationUnit) || '',
      emptyMessage: 'Log duration on more days to plot this chart.',
      chartAccessibilityLabel: 'Duration by session chart',
    });
  }
  if (scoreSnapshots.length > 0) {
    charts.push({
      key: 'score',
      title: 'Score By Session',
      lines: buildValueChartLines(scoreSnapshots, activeScheme, 'Score'),
      yAxisLabel: 'Score',
      formatYTick: (value) => `${formatDisplayDecimal(value, DISPLAY_DECIMAL_PLACES)} ${SCORE_UNIT_ABBREVIATIONS[scoreUnit]}`,
      emptyMessage: 'Log numeric scores on more days to plot this chart.',
      chartAccessibilityLabel: 'Score by session chart',
    });
  }
  charts.push(executionChartConfig(logged, target, 'sport', activeScheme));

  return {
    charts,
    infoMessages: {
      execution:
        'For each logged appearance (duplicate slots in one workout each count separately), execution averages the ratios you hit vs plan:\n\n' +
        '• Duration ratio when both planned and actual duration exist\n' +
        '• Score ratio when both planned and actual scores are numeric\n\n' +
        'The percentage shown is the average across all logged appearances (duplicate slots in one workout each count separately).',
    },
  };
}

function stretchMetricsConfig(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activeScheme: 'light' | 'dark',
): { charts: MetricChartConfig[]; infoMessages: Record<string, string> } {
  const latest = latestLoggedExercise(logged, target);
  const durationSnapshots = getStretchTotalDurationSnapshots(logged, target);
  const durationUnit =
    latest?.actualStretchSets[0]?.actualDurationUnit ?? latest?.durationUnit ?? 'seconds';

  const charts: MetricChartConfig[] = [
    {
      key: 'duration',
      title: 'Total Stretch Time By Session',
      lines: buildValueChartLines(durationSnapshots, activeScheme, 'Total Duration'),
      yAxisLabel: 'Duration',
      formatYTick: (value) => formatDurationWithUnit(value, durationUnit) || '',
      emptyMessage:
        'Log stretch sets on more days to plot total stretch time. Each point sums all sets in that session.',
      chartAccessibilityLabel: 'Total stretch time by session chart',
    },
    executionChartConfig(logged, target, 'stretch', activeScheme),
  ];

  return {
    charts,
    infoMessages: {
      execution:
        'For each logged stretch appearance (duplicate slots in one workout each count separately):\n\n' +
        '• Actual total = sum of all logged set durations\n' +
        '• Planned total = sum of planned set durations from that session\n' +
        '• Execution = actual total ÷ planned total\n\n' +
        'The percentage shown is the average across all logged appearances (duplicate slots in one workout each count separately).',
      lifetimeDuration:
        'Adds up every logged stretch set duration for this exercise across all sessions.',
    },
  };
}

function strengthMetricsConfig(
  logged: LoggedWorkout[],
  target: StoredExerciseMetricTarget,
  activeScheme: 'light' | 'dark',
): { charts: MetricChartConfig[]; infoMessages: Record<string, string> } {
  const weightSnapshots = getLoggedExerciseWeightSnapshots(logged, target);
  const weightLines: ScoreDateLineSeries[] = [
    {
      id: 'actual-weight',
      label: 'Weight',
      color: Colors[activeScheme].tint,
      points: weightSnapshots.map((snapshot) => ({
        score: snapshot.avgActualWeightKg,
        dateMs: new Date(snapshot.createdAt).getTime(),
      })),
    },
  ];

  return {
    charts: [
      {
        key: 'weight',
        title: 'Weight By Session',
        lines: weightLines,
        yAxisLabel: 'Weight',
        formatYTick: formatWeightTick,
        emptyMessage: CHART_WEIGHT_EMPTY_MESSAGE,
        chartAccessibilityLabel: 'Weight by session chart',
      },
      executionChartConfig(logged, target, 'strength', activeScheme),
    ],
    infoMessages: {
      execution: EXECUTION_SCORE_INFO_MESSAGE,
      totalWeightMoved: TOTAL_WEIGHT_MOVED_INFO_MESSAGE,
    },
  };
}

export function ActivityExerciseMetricsView({
  activityType,
  logged,
  workouts,
  metricTarget,
  exerciseLoggedCount,
  lastLoggedIso,
  activeScheme,
  borderColor,
  textColor,
  chartCarouselSlideWidth,
  chartPlotWidth,
}: Props) {
  const executionScorePercent = useMemo(() => {
    if (activityType === 'strength') {
      return averageExerciseExecutionScorePercent(logged, metricTarget);
    }
    return averageActivityExecutionScorePercent(logged, metricTarget, activityType);
  }, [activityType, logged, metricTarget]);

  const strengthPrs = useMemo(
    () => (activityType === 'strength' ? getExercisePersonalRecords(logged, metricTarget) : null),
    [activityType, logged, metricTarget],
  );
  const totalWeightMoved = useMemo(
    () => (activityType === 'strength' ? getTotalWeightMovedForExercise(logged, metricTarget) : 0),
    [activityType, logged, metricTarget],
  );

  const { charts, infoMessages } = useMemo(() => {
    switch (activityType) {
      case 'cardio':
        return cardioMetricsConfig(logged, workouts, metricTarget, activeScheme);
      case 'sport':
        return sportMetricsConfig(logged, metricTarget, activeScheme);
      case 'stretch':
        return stretchMetricsConfig(logged, metricTarget, activeScheme);
      case 'strength':
        return strengthMetricsConfig(logged, metricTarget, activeScheme);
      default:
        return { charts: [executionChartConfig(logged, metricTarget, activityType, activeScheme)], infoMessages: {} };
    }
  }, [activityType, activeScheme, logged, metricTarget, workouts]);

  const cardioPrs = useMemo(
    () => (activityType === 'cardio' ? getCardioPersonalRecords(logged, metricTarget) : null),
    [activityType, logged, metricTarget],
  );
  const sportPrs = useMemo(
    () => (activityType === 'sport' ? getSportPersonalRecords(logged, metricTarget) : null),
    [activityType, logged, metricTarget],
  );
  const stretchPrs = useMemo(
    () => (activityType === 'stretch' ? getStretchPersonalRecords(logged, metricTarget) : null),
    [activityType, logged, metricTarget],
  );

  const lifetimeCardioDistance = useMemo(
    () => (activityType === 'cardio' ? getCardioLifetimeDistance(logged, metricTarget) : 0),
    [activityType, logged, metricTarget],
  );
  const lifetimeStretchDuration = useMemo(
    () => (activityType === 'stretch' ? getStretchLifetimeDuration(logged, metricTarget) : 0),
    [activityType, logged, metricTarget],
  );
  const cardioDistanceDisplayUnit = useMemo(() => {
    if (activityType !== 'cardio') {
      return 'miles' as const;
    }
    return (
      cardioPrs?.maxDistanceUnit ??
      cardioMetricDisplayDistanceUnit(latestLoggedExercise(logged, metricTarget))
    );
  }, [activityType, cardioPrs, logged, metricTarget]);

  const [visibleChartIndex, setVisibleChartIndex] = useState(0);
  const chartCarouselRef = useRef<FlatList<MetricChartConfig>>(null);
  const chartCarouselScrollable = charts.length > 1;

  useEffect(() => {
    setVisibleChartIndex(0);
    chartCarouselRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [metricTarget, activityType]);

  const onChartViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const idx = viewableItems[0]?.index;
      if (idx != null) {
        setVisibleChartIndex(idx);
      }
    },
    [],
  );
  const chartViewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 55 }), []);

  const metricRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; value: string; infoMessage?: string }> = [
      {
        key: 'times-logged',
        label: 'Times Logged',
        value: String(exerciseLoggedCount),
      },
      {
        key: 'execution',
        label: 'Execution Score',
        value: executionScorePercent !== null ? `${executionScorePercent.toFixed(0)}%` : '—',
        infoMessage: infoMessages.execution,
      },
    ];

    if (activityType === 'strength' && strengthPrs) {
      rows.push(
        {
          key: 'pr-weight',
          label: 'Personal Record, Weight',
          value: formatPrWeightLb(strengthPrs.maxWeight),
        },
        {
          key: 'pr-reps',
          label: 'Personal Record, Reps',
          value: formatPrInt(strengthPrs.maxReps),
        },
        {
          key: 'pr-sets',
          label: 'Personal Record, Sets',
          value: formatPrInt(strengthPrs.maxSets),
        },
        {
          key: 'lifetime-weight',
          label: 'Total Weight Moved',
          value: formatTotalWeightMoved(totalWeightMoved),
          infoMessage: infoMessages.totalWeightMoved,
        },
      );
    }

    if (activityType === 'cardio' && cardioPrs) {
      rows.push(
        {
          key: 'pr-distance',
          label: 'Personal Record, Distance',
          value: formatCardioPrDistance(cardioPrs.maxDistance, cardioPrs.maxDistanceUnit),
        },
        {
          key: 'pr-duration',
          label: 'Personal Record, Duration',
          value: formatDurationPr(cardioPrs.maxDuration, cardioPrs.maxDurationUnit),
        },
        {
          key: 'pr-pace',
          label: 'Best Pace',
          value: formatCardioPacePr(
            cardioPrs.bestPaceDuration,
            cardioPrs.bestPaceDurationUnit,
            cardioPrs.bestPaceDistance,
            cardioPrs.bestPaceDistanceUnit,
          ),
        },
        {
          key: 'lifetime-distance',
          label: 'Total Distance Logged',
          value:
            lifetimeCardioDistance > 0
              ? formatCardioDistanceWithUnit(lifetimeCardioDistance, cardioDistanceDisplayUnit)
              : '—',
        },
      );
    }

    if (activityType === 'sport' && sportPrs) {
      rows.push(
        {
          key: 'pr-duration',
          label: 'Personal Record, Duration',
          value: formatDurationPr(sportPrs.maxDuration, sportPrs.maxDurationUnit),
        },
        {
          key: 'pr-score',
          label: 'Personal Record, Score',
          value: formatSportScorePr(sportPrs.maxNumericScore, sportPrs.maxScoreUnit, sportPrs.bestScoreLabel),
        },
      );
    }

    if (activityType === 'stretch' && stretchPrs) {
      rows.push(
        {
          key: 'pr-set',
          label: 'Personal Record, Longest Set',
          value: formatDurationPr(stretchPrs.maxSingleSetDuration, stretchPrs.maxSingleSetUnit),
        },
        {
          key: 'pr-sets',
          label: 'Personal Record, Sets',
          value: formatPrInt(stretchPrs.maxSetsInSession),
        },
        {
          key: 'pr-session',
          label: 'Personal Record, Session Total',
          value: formatDurationPr(stretchPrs.maxTotalSessionDuration, stretchPrs.maxTotalSessionUnit),
        },
        {
          key: 'lifetime-duration',
          label: 'Total Stretch Time',
          value:
            lifetimeStretchDuration > 0 && stretchPrs.maxTotalSessionUnit
              ? formatDurationWithUnit(lifetimeStretchDuration, stretchPrs.maxTotalSessionUnit)
              : '—',
          infoMessage: infoMessages.lifetimeDuration,
        },
      );
    }

    rows.push({
      key: 'last-logged',
      label: 'Last Logged',
      value: formatLastLoggedDisplay(lastLoggedIso),
    });

    return rows;
  }, [
    activityType,
    cardioDistanceDisplayUnit,
    cardioPrs,
    executionScorePercent,
    exerciseLoggedCount,
    infoMessages,
    lastLoggedIso,
    lifetimeCardioDistance,
    lifetimeStretchDuration,
    sportPrs,
    strengthPrs,
    stretchPrs,
    totalWeightMoved,
  ]);

  return (
    <>
      <View style={[styles.metricsCard, { borderColor }]}>
        {metricRows.map((row, index) => (
          <View
            key={row.key}
            style={[styles.metricRow, index > 0 ? [styles.metricRowDivider, { borderTopColor: borderColor }] : null]}>
            <View style={styles.metricLabelWithInfo}>
              <Text style={styles.metricTitleText} numberOfLines={2}>
                {row.label}
              </Text>
              {row.infoMessage ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`How ${row.label} is calculated`}
                  hitSlop={10}
                  onPress={() => themedAlert(row.label, row.infoMessage ?? '', [{ text: 'OK' }])}
                  style={({ pressed }) => [styles.metricInfoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors[activeScheme].tint} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.metricValue} numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.chartCarouselOuter, { width: chartCarouselSlideWidth }]}>
        {chartCarouselScrollable ? (
          <View
            style={styles.chartScrollHintRow}
            accessible
            accessibilityLabel="Swipe sideways to see more charts">
            <Ionicons name="swap-horizontal" size={16} color={textColor} style={styles.chartScrollHintIcon} />
          </View>
        ) : null}
        <FlatList
          ref={chartCarouselRef}
          data={charts}
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
            accessibilityLabel={`Chart ${visibleChartIndex + 1} of ${charts.length}`}>
            {charts.map((chart, index) => (
              <View
                key={chart.key}
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
  );
}

const styles = StyleSheet.create({
  metricsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 4,
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
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
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
});
