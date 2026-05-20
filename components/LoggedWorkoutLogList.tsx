import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import { WorkoutIconGlyph } from '@/components/WorkoutIconGlyph';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { navigateToEditLoggedWorkout } from '@/lib/logWorkoutNavigation';
import { themedAlert } from '@/lib/themedAlert';
import { deleteLoggedWorkout, loadLoggedWorkouts } from '@/lib/workoutsStorage';
import type { LoggedWorkout } from '@/lib/types';

/** Local calendar date key `YYYY-MM-DD` from an ISO timestamp. */
function localDateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateKeyFromParts(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startWeekdaySunday0(year: number, monthIndex: number): number {
  return new Date(year, monthIndex, 1).getDay();
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function LoggedWorkoutLogList() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const tint = Colors[activeScheme].tint;
  const borderMuted = activeScheme === 'dark' ? '#333' : '#e5e5e5';
  const textColor = Colors[activeScheme].text;

  const [workouts, setWorkouts] = useState<LoggedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

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

  const datesWithLogs = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) {
      set.add(localDateKeyFromIso(w.createdAt));
    }
    return set;
  }, [workouts]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, LoggedWorkout[]>();
    for (const w of workouts) {
      const key = localDateKeyFromIso(w.createdAt);
      const list = map.get(key) ?? [];
      list.push(w);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return map;
  }, [workouts]);

  const calendarCells = useMemo(() => {
    const dim = daysInMonth(calendarYear, calendarMonth);
    const startPad = startWeekdaySunday0(calendarYear, calendarMonth);
    const cells: Array<{ key: string; day: number | null; dateKey: string | null }> = [];
    let i = 0;
    for (; i < startPad; i++) {
      cells.push({ key: `pad-${calendarYear}-${calendarMonth}-s${i}`, day: null, dateKey: null });
    }
    for (let day = 1; day <= dim; day++) {
      cells.push({
        key: `d-${calendarYear}-${calendarMonth}-${day}`,
        day,
        dateKey: dateKeyFromParts(calendarYear, calendarMonth, day),
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ key: `pad-${calendarYear}-${calendarMonth}-e${i}`, day: null, dateKey: null });
      i++;
    }
    return cells;
  }, [calendarYear, calendarMonth]);

  const onDelete = (workout: LoggedWorkout) => {
    themedAlert('Delete workout?', `Remove “${workout.title}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteLoggedWorkout(workout.id);
            const next = await loadLoggedWorkouts();
            setWorkouts(next);
            if (selectedDateKey) {
              const stillOnDay = next.filter((w) => localDateKeyFromIso(w.createdAt) === selectedDateKey);
              if (stillOnDay.length === 0) {
                setSelectedDateKey(null);
              }
            }
          })();
        },
      },
    ]);
  };

  const goPrevMonth = () => {
    setSelectedDateKey(null);
    if (calendarMonth === 0) {
      setCalendarYear((y) => y - 1);
      setCalendarMonth(11);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    setSelectedDateKey(null);
    if (calendarMonth === 11) {
      setCalendarYear((y) => y + 1);
      setCalendarMonth(0);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const monthTitle = new Date(calendarYear, calendarMonth, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const selectedDayLogs = selectedDateKey ? (logsByDate.get(selectedDateKey) ?? []) : [];
  const selectedDayLabel = selectedDateKey
    ? new Date(
        Number.parseInt(selectedDateKey.slice(0, 4), 10),
        Number.parseInt(selectedDateKey.slice(5, 7), 10) - 1,
        Number.parseInt(selectedDateKey.slice(8, 10), 10),
      ).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const renderWorkoutCard = (item: LoggedWorkout) => (
    <RNView key={item.id} style={[styles.card, { borderColor: borderMuted }]}>
      <View style={styles.cardHeader} lightColor="transparent" darkColor="transparent">
        <View style={styles.cardTitleBlock} lightColor="transparent" darkColor="transparent">
          <View style={styles.cardTitleWithIcon} lightColor="transparent" darkColor="transparent">
            <WorkoutIconGlyph iconId={item.iconId} size={22} color="#D40078" />
            <Text style={[styles.cardTitle, styles.cardTitleMagenta]} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </View>
        <RNView style={styles.cardActions}>
          <Pressable
            onPress={() => navigateToEditLoggedWorkout(item.workoutId, item.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Edit logged workout “${item.title}”`}>
            <Ionicons name="pencil-outline" size={22} color={tint} />
          </Pressable>
          <Pressable
            onPress={() => onDelete(item)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete logged workout “${item.title}”`}>
            <Ionicons name="trash-outline" size={22} color="#ef4444" />
          </Pressable>
        </RNView>
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
          <Text style={[styles.exerciseName, { color: textColor }]}>{ex.name}</Text>
          <Text style={[styles.setLine, { color: textColor }]}>
            Planned: {ex.sets} set{ex.sets === 1 ? '' : 's'} x {ex.reps} reps @ {ex.weightKg} lb
          </Text>
          {ex.actualSets.map((actualSet, setIndex) => (
            <Text key={`${ex.id}-actual-set-${setIndex}`} style={[styles.setLine, { color: textColor }]}>
              Actual set {setIndex + 1}: {actualSet.actualReps} reps @ {actualSet.actualWeightKg} lb
            </Text>
          ))}
        </View>
      ))}
    </RNView>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (workouts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No logged workouts</Text>
        <Text style={styles.emptySubtitle}>
          Open a workout on the Workouts tab and tap Log Workout to record a session. Everything stays on this device.
        </Text>
      </View>
    );
  }

  const today = new Date();
  const todayKey = dateKeyFromParts(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={[styles.calendarCard, { borderColor: borderMuted }]}>
        <View style={styles.monthNav} lightColor="transparent" darkColor="transparent">
          <Pressable onPress={goPrevMonth} style={({ pressed }) => [styles.monthNavBtn, pressed && styles.pressed]} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={tint} />
          </Pressable>
          <Text style={styles.monthTitle}>{monthTitle}</Text>
          <Pressable onPress={goNextMonth} style={({ pressed }) => [styles.monthNavBtn, pressed && styles.pressed]} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={tint} />
          </Pressable>
        </View>
        <View style={styles.weekdayRow} lightColor="transparent" darkColor="transparent">
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={[styles.weekdayCell, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.grid} lightColor="transparent" darkColor="transparent">
          {Array.from({ length: Math.ceil(calendarCells.length / 7) }, (_, row) => (
            <View key={`row-${row}`} style={styles.calendarRow} lightColor="transparent" darkColor="transparent">
              {calendarCells.slice(row * 7, row * 7 + 7).map((cell) => {
                if (cell.day === null || cell.dateKey === null) {
                  return <View key={cell.key} style={styles.dayCell} lightColor="transparent" darkColor="transparent" />;
                }
                const hasLogs = datesWithLogs.has(cell.dateKey);
                const isSelected = selectedDateKey === cell.dateKey;
                const isToday = cell.dateKey === todayKey;
                return (
                  <Pressable
                    key={cell.key}
                    accessibilityRole="button"
                    accessibilityLabel={
                      hasLogs
                        ? `${cell.day}, ${monthTitle}, ${logsByDate.get(cell.dateKey)?.length ?? 0} logged session(s)`
                        : `${cell.day}, ${monthTitle}, no sessions`
                    }
                    disabled={!hasLogs}
                    onPress={() => {
                      if (!hasLogs) {
                        return;
                      }
                      setSelectedDateKey((prev) => (prev === cell.dateKey ? null : cell.dateKey));
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      styles.dayCellInner,
                      hasLogs && {
                        borderColor: '#D40078',
                        backgroundColor: activeScheme === 'dark' ? 'rgba(35, 213, 213, 0.12)' : 'rgba(57, 170, 170, 0.12)',
                      },
                      isSelected && { borderWidth: 2, borderColor: tint },
                      isToday &&
                        !isSelected && {
                          borderWidth: 1,
                          borderColor:
                            activeScheme === 'dark' ? 'rgba(35, 213, 213, 0.35)' : 'rgba(57, 170, 170, 0.35)',
                        },
                      !hasLogs && styles.dayCellMuted,
                      pressed && hasLogs && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.dayNum,
                        { color: textColor },
                        hasLogs && styles.dayNumHasLogs,
                        !hasLogs && { opacity: 0.45 },
                      ]}>
                      {cell.day}
                    </Text>
                    {hasLogs ? (
                      <RNView style={[styles.logDot, { backgroundColor: '#D40078' }]} />
                    ) : (
                      <RNView style={styles.logDotPlaceholder} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {selectedDateKey ? (
        <View style={styles.daySection} lightColor="transparent" darkColor="transparent">
          <Text style={[styles.daySectionTitle, { color: textColor }]}>{selectedDayLabel}</Text>
          {selectedDayLogs.length === 0 ? (
            <Text style={styles.meta}>No sessions on this day.</Text>
          ) : (
            selectedDayLogs.map(renderWorkoutCard)
          )}
        </View>
      ) : (
        <Text style={[styles.hint, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
          Tap a highlighted day to see workouts logged that day.
        </Text>
      )}
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
    gap: 16,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthNavBtn: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  grid: {
    marginTop: 4,
    gap: 4,
  },
  calendarRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    minWidth: 0,
  },
  dayCellInner: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    minHeight: 44,
  },
  dayCellMuted: {
    opacity: 1,
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '500',
  },
  dayNumHasLogs: {
    fontWeight: '700',
  },
  logDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 3,
  },
  logDotPlaceholder: {
    width: 5,
    height: 5,
    marginTop: 3,
  },
  pressed: {
    opacity: 0.65,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  daySection: {
    gap: 12,
  },
  daySectionTitle: {
    fontSize: 17,
    fontWeight: '700',
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
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
    minWidth: 0,
  },
  cardTitleMagenta: {
    color: '#D40078',
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
