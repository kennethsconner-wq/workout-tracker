import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityExerciseMetricsView } from '@/components/ActivityExerciseMetricsView';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { activityTypeLabel } from '@/lib/exerciseDisplay';
import { collectStoredExerciseOptions, countExerciseLoggedAppearances, getExerciseLastLoggedAtIso } from '@/lib/exerciseSnapshot';
import { loadLoggedWorkouts, loadWorkouts } from '@/lib/workoutsStorage';
import type { LoggedWorkout, Workout } from '@/lib/types';

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
  const selectedActivityType = selectedExercise?.activityType ?? 'strength';
  const metricTarget = selectedExercise;
  const exerciseLoggedCount = metricTarget ? countExerciseLoggedAppearances(logged, metricTarget) : 0;
  const lastLoggedIso = useMemo(
    () => (metricTarget ? getExerciseLastLoggedAtIso(logged, metricTarget) : null),
    [logged, metricTarget],
  );
  const scrollInnerWidth = Math.max(0, windowWidth - 32);
  const chartCarouselSlideWidth = scrollInnerWidth;
  const chartPlotWidth = Math.max(160, chartCarouselSlideWidth - 28);

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
          <View style={styles.dropdownTextBlock} lightColor="transparent" darkColor="transparent">
            <Text style={[styles.dropdownText, styles.dropdownTextMagenta]} numberOfLines={1}>
              {selectedExercise?.name ?? 'Select'}
            </Text>
            {selectedExercise ? (
              <Text
                style={[styles.dropdownMeta, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}
                numberOfLines={1}>
                {activityTypeLabel(selectedExercise.activityType)}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-down" size={20} color="#D40078" />
        </Pressable>

        {selectedExerciseId !== null && metricTarget ? (
          <ActivityExerciseMetricsView
            activityType={selectedActivityType}
            logged={logged}
            workouts={workouts}
            metricTarget={metricTarget}
            exerciseLoggedCount={exerciseLoggedCount}
            lastLoggedIso={lastLoggedIso}
            activeScheme={activeScheme}
            borderColor={borderColor}
            textColor={textColor}
            chartCarouselSlideWidth={chartCarouselSlideWidth}
            chartPlotWidth={chartPlotWidth}
          />
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
                  <View style={styles.optionTextBlock} lightColor="transparent" darkColor="transparent">
                    <Text style={[styles.optionText, styles.dropdownTextMagenta]} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={[styles.optionMeta, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                      {activityTypeLabel(item.activityType)}
                    </Text>
                  </View>
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
  dropdownMeta: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 0,
  },
  dropdownTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  dropdownText: {
    fontSize: 16,
  },
  dropdownTextMagenta: {
    color: '#D40078',
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
  optionTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionText: {
    fontSize: 16,
  },
  optionMeta: {
    fontSize: 13,
    marginTop: 2,
  },
});
