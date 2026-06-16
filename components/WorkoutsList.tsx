import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { WorkoutIconGlyph } from '@/components/WorkoutIconGlyph';
import { formatWorkoutSummary } from '@/lib/exerciseDisplay';
import { buildCopyWorkoutPayload } from '@/lib/exerciseDraft';
import {
  getWorkoutDueIndicator,
  pickWorkoutIdForDeviceCalendarDay,
  sortWorkoutsForDropdown,
  type WorkoutDueIndicator,
  type WorkoutDueTone,
} from '@/lib/deviceDayOfWeek';
import { getWorkoutIdsWithNewLogDrafts } from '@/lib/logWorkoutDraft';
import {
  navigateToNewLogWorkout,
  navigateToNewLogWorkoutFresh,
  navigateToResumeLogWorkout,
} from '@/lib/logWorkoutNavigation';
import { themedAlert } from '@/lib/themedAlert';
import {
  buildWorkoutLogStatsByWorkoutId,
  formatWorkoutLastLogged,
  formatWorkoutSessionCount,
  formatWorkoutTrackingSince,
} from '@/lib/loggedWorkoutAnalytics';
import { deleteLoggedWorkoutsByWorkoutId, deleteWorkout, loadLoggedWorkouts, loadWorkouts } from '@/lib/workoutsStorage';
import { DAYS_OF_WEEK, DAY_OF_WEEK_ABBREVIATIONS, type LoggedWorkout, type Workout } from '@/lib/types';

/** Matches `@react-navigation/elements` `HeaderTitle` (Workouts screen title). */
const DROPDOWN_TITLE_FONT_SIZE = Platform.select({ ios: 17, android: 20, default: 18 });

const ACTION_SHEET_SLIDE = 320;
const WORKOUT_CARD_GAP = 12;
const WORKOUT_CARD_PEEK = 18;

const WORKOUT_DUE_TONE_COLORS: Record<WorkoutDueTone, string> = {
  due_today: '#D40078',
  upcoming: '#737373',
  completed_today: '#16a34a',
};

function workoutDueIcon(tone: WorkoutDueTone): keyof typeof Ionicons.glyphMap {
  switch (tone) {
    case 'due_today':
      return 'alert-circle-outline';
    case 'completed_today':
      return 'checkmark-circle-outline';
    default:
      return 'calendar-outline';
  }
}

function workoutDuePresentation(
  indicator: WorkoutDueIndicator,
  activeScheme: 'light' | 'dark',
): { color: string; backgroundColor: string } {
  const color =
    indicator.tone === 'upcoming' && activeScheme === 'dark' ? '#a3a3a3' : WORKOUT_DUE_TONE_COLORS[indicator.tone];
  const backgroundColor =
    indicator.tone === 'due_today'
      ? 'rgba(212, 0, 120, 0.12)'
      : indicator.tone === 'completed_today'
        ? 'rgba(22, 163, 74, 0.12)'
        : activeScheme === 'dark'
          ? 'rgba(255, 255, 255, 0.08)'
          : 'rgba(0, 0, 0, 0.05)';
  return { color, backgroundColor };
}

export function WorkoutsList() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loggedWorkouts, setLoggedWorkouts] = useState<LoggedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [maxCardHeight, setMaxCardHeight] = useState(0);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [draftWorkoutIds, setDraftWorkoutIds] = useState<Set<string>>(() => new Set());
  const sheetTranslateY = useRef(new Animated.Value(ACTION_SHEET_SLIDE)).current;
  const carouselRef = useRef<FlatList<Workout>>(null);

  const textColor = Colors[activeScheme].text;
  const mutedTextColor = activeScheme === 'dark' ? '#a3a3a3' : '#737373';
  /** Carousel page border when not selected. */
  const borderColor = '#d4d4d4';
  /** Workout card: dark tint (`#23D5D5`) in dark mode, neutral in light. */
  const cardBorderColor = activeScheme === 'dark' ? Colors.dark.tint : '#d4d4d4';
  const formatDays = useCallback(
    (days: Workout['daysOfWeek']) =>
      [...days]
        .sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b))
        .map((day) => DAY_OF_WEEK_ABBREVIATIONS[day])
        .join(', '),
    [],
  );

  const { fonts } = useTheme();
  const headerTitleFontStyle = useMemo(
    () => Platform.select({ ios: fonts.bold, default: fonts.medium }),
    [fonts],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const [next, nextLogged, draftIds] = await Promise.all([
          loadWorkouts(),
          loadLoggedWorkouts(),
          getWorkoutIdsWithNewLogDrafts(),
        ]);
        if (!cancelled) {
          setWorkouts(next);
          setLoggedWorkouts(nextLogged);
          setDraftWorkoutIds(draftIds);
          setSelectedId((prev) => pickWorkoutIdForDeviceCalendarDay(next, prev));
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const selected = useMemo(() => {
    if (workouts.length === 0) {
      return undefined;
    }
    return workouts.find((w) => w.id === selectedId) ?? workouts[0];
  }, [workouts, selectedId]);

  const dropdownWorkouts = useMemo(() => sortWorkoutsForDropdown(workouts), [workouts]);
  const workoutLogStats = useMemo(() => buildWorkoutLogStatsByWorkoutId(loggedWorkouts), [loggedWorkouts]);

  const selectedCarouselIndex = useMemo(
    () => dropdownWorkouts.findIndex((w) => w.id === selectedId),
    [dropdownWorkouts, selectedId],
  );
  const hasMultipleWorkouts = dropdownWorkouts.length > 1;
  const cardPeek = hasMultipleWorkouts ? WORKOUT_CARD_PEEK : 0;
  const cardWidth = trackWidth > 0 ? trackWidth - cardPeek * 2 : 0;
  const cardStride = cardWidth + (hasMultipleWorkouts ? WORKOUT_CARD_GAP : 0);

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) {
      setTrackWidth((prev) => (Math.abs(next - prev) < 0.5 ? prev : next));
    }
  }, []);

  const scrollCarouselToWorkoutId = useCallback(
    (id: string | null, animated: boolean) => {
      if (!id || cardStride <= 0) {
        return;
      }
      const index = dropdownWorkouts.findIndex((w) => w.id === id);
      if (index < 0) {
        return;
      }
      carouselRef.current?.scrollToOffset({ offset: index * cardStride, animated });
    },
    [cardStride, dropdownWorkouts],
  );

  useEffect(() => {
    setMaxCardHeight(0);
  }, [dropdownWorkouts, draftWorkoutIds, cardWidth]);

  const reportWorkoutCardHeight = useCallback((height: number) => {
    const nextHeight = Math.ceil(height);
    if (nextHeight <= 0) {
      return;
    }
    setMaxCardHeight((prev) => (nextHeight > prev ? nextHeight : prev));
  }, []);

  useEffect(() => {
    scrollCarouselToWorkoutId(selectedId, false);
  }, [selectedId, scrollCarouselToWorkoutId]);

  const onCarouselMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (cardStride <= 0 || dropdownWorkouts.length === 0) {
        return;
      }
      const page = Math.round(event.nativeEvent.contentOffset.x / cardStride);
      const idx = Math.max(0, Math.min(dropdownWorkouts.length - 1, page));
      const next = dropdownWorkouts[idx];
      if (next && next.id !== selectedId) {
        setSelectedId(next.id);
      }
    },
    [cardStride, dropdownWorkouts, selectedId],
  );

  const closeActionSheet = useCallback(
    (afterClose?: () => void) => {
      Animated.timing(sheetTranslateY, {
        toValue: ACTION_SHEET_SLIDE,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setIsActionSheetOpen(false);
          afterClose?.();
        }
      });
    },
    [sheetTranslateY],
  );

  const openActionSheet = useCallback(() => {
    setIsActionSheetOpen(true);
  }, []);

  useEffect(() => {
    if (!isActionSheetOpen) {
      return;
    }
    sheetTranslateY.setValue(ACTION_SHEET_SLIDE);
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      damping: 22,
      stiffness: 220,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [isActionSheetOpen, sheetTranslateY]);

  useEffect(() => {
    if (!isActionSheetOpen) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeActionSheet();
      return true;
    });
    return () => sub.remove();
  }, [isActionSheetOpen, closeActionSheet]);

  const onStartWorkout = useCallback((workoutId: string) => {
    if (draftWorkoutIds.has(workoutId)) {
      themedAlert(
        'Start fresh?',
        'Starting a new workout will clear your saved draft for this workout.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start fresh',
            style: 'destructive',
            onPress: () => {
              void navigateToNewLogWorkoutFresh(workoutId);
            },
          },
        ],
      );
      return;
    }
    navigateToNewLogWorkout(workoutId);
  }, [draftWorkoutIds]);

  const onDelete = (workout: Workout) => {
    themedAlert(
      'Delete workout?',
      `Remove “${workout.title}”? This cannot be undone.\n\nAll logged workouts linked to this workout will also be deleted.`,
      [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const id = workout.id;
            await deleteWorkout(id);
            await deleteLoggedWorkoutsByWorkoutId(id);
            const [updated, updatedLogged] = await Promise.all([loadWorkouts(), loadLoggedWorkouts()]);
            setWorkouts(updated);
            setLoggedWorkouts(updatedLogged);
            setSelectedId((prev) => pickWorkoutIdForDeviceCalendarDay(updated, prev === id ? null : prev));
          })();
        },
      },
    ],
    );
  };

  const onCopy = (workout: Workout) => {
    router.push({
      pathname: '/workouts',
      params: { copyWorkout: JSON.stringify(buildCopyWorkoutPayload(workout)) },
    });
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
        <Pressable
          style={[styles.cta, { backgroundColor: Colors[activeScheme].tint }]}
          onPress={() => router.push('/workouts')}>
          <Text style={styles.ctaLabel}>Create a workout</Text>
        </Pressable>
      </View>
    );
  }

  const sheetBackground = activeScheme === 'dark' ? '#1e1a2e' : '#ffffff';
  const sheetBorder = activeScheme === 'dark' ? '#3d3558' : '#e5e5e5';

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.carouselRow}>
          <View style={styles.carouselTrack} onLayout={onTrackLayout}>
            {cardWidth > 0 ? (
              <FlatList
                ref={carouselRef}
                data={dropdownWorkouts}
                keyExtractor={(w) => w.id}
                horizontal
                nestedScrollEnabled
                removeClippedSubviews={false}
                showsHorizontalScrollIndicator={hasMultipleWorkouts}
                keyboardShouldPersistTaps="handled"
                extraData={{ selectedId, maxCardHeight, draftWorkoutIds }}
                initialNumToRender={dropdownWorkouts.length}
                maxToRenderPerBatch={dropdownWorkouts.length}
                windowSize={Math.max(5, dropdownWorkouts.length)}
                style={maxCardHeight > 0 ? { height: maxCardHeight } : undefined}
                onMomentumScrollEnd={onCarouselMomentumEnd}
                snapToInterval={hasMultipleWorkouts ? cardStride : undefined}
                snapToAlignment="start"
                decelerationRate={hasMultipleWorkouts ? 'fast' : undefined}
                pagingEnabled={!hasMultipleWorkouts}
                contentContainerStyle={hasMultipleWorkouts ? { paddingHorizontal: cardPeek } : undefined}
                getItemLayout={(_, index) => ({
                  length: cardStride,
                  offset: cardStride * index,
                  index,
                })}
                renderItem={({ item: w, index }) => {
                  const isSelected = w.id === selectedId;
                  const summary = formatWorkoutSummary(w.exercises);
                  const logStats = workoutLogStats.get(w.id);
                  const trackingSince = formatWorkoutTrackingSince(
                    logStats?.firstLoggedAt ?? null,
                    logStats?.sessionCount ?? 0,
                  );
                  const dueIndicator = getWorkoutDueIndicator(w.daysOfWeek, logStats?.lastLoggedAt ?? null);
                  const duePresentation = dueIndicator ? workoutDuePresentation(dueIndicator, activeScheme) : null;
                  const isLastCard = index === dropdownWorkouts.length - 1;
                  return (
                    <RNView
                      onLayout={
                        maxCardHeight > 0
                          ? undefined
                          : (event) => reportWorkoutCardHeight(event.nativeEvent.layout.height)
                      }
                      style={[
                        styles.workoutCard,
                        {
                          width: cardWidth,
                          marginRight: hasMultipleWorkouts && !isLastCard ? WORKOUT_CARD_GAP : 0,
                          borderColor: isSelected ? Colors[activeScheme].tint : borderColor,
                          backgroundColor: Colors[activeScheme].background,
                        },
                        maxCardHeight > 0 ? { height: maxCardHeight } : null,
                      ]}>
                      <View style={styles.workoutCardHeader} lightColor="transparent" darkColor="transparent">
                        <View style={styles.workoutCardHeaderTopRow} lightColor="transparent" darkColor="transparent">
                          <View style={styles.workoutCardHeaderSide} lightColor="transparent" darkColor="transparent" />
                          <Pressable
                            onPress={() => {
                              setSelectedId(w.id);
                              carouselRef.current?.scrollToOffset({
                                offset: index * cardStride,
                                animated: true,
                              });
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={w.title}
                            style={styles.workoutTitlePressable}>
                            <View style={styles.workoutTitleRow} lightColor="transparent" darkColor="transparent">
                              <WorkoutIconGlyph iconId={w.iconId} size={22} color="#D40078" />
                              <Text
                                style={[styles.workoutTitle, styles.dropdownTextMagenta, headerTitleFontStyle]}
                                numberOfLines={1}>
                                {w.title}
                              </Text>
                            </View>
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Workout actions"
                            onPress={() => {
                              if (!isSelected) {
                                setSelectedId(w.id);
                                carouselRef.current?.scrollToOffset({
                                  offset: index * cardStride,
                                  animated: true,
                                });
                              }
                              openActionSheet();
                            }}
                            style={({ pressed }) => [
                              styles.workoutCardMenuButton,
                              pressed && styles.iconActionButtonPressed,
                            ]}
                            hitSlop={10}>
                            <Ionicons name="ellipsis-vertical" size={22} color={Colors[activeScheme].tint} />
                          </Pressable>
                        </View>
                        <View
                          style={[
                            styles.workoutCardHeaderDivider,
                            { backgroundColor: isSelected ? Colors[activeScheme].tint : cardBorderColor },
                          ]}
                        />
                      </View>
                      <View
                        style={[styles.workoutCardBody, maxCardHeight > 0 ? styles.workoutCardBodyExpanded : null]}
                        lightColor="transparent"
                        darkColor="transparent">
                        <View style={styles.scheduleRow} lightColor="transparent" darkColor="transparent">
                          <View style={styles.scheduleDaysGroup} lightColor="transparent" darkColor="transparent">
                            <Ionicons name="calendar-outline" size={16} color={Colors[activeScheme].tint} />
                            <Text
                              style={[styles.detailDaysText, { color: Colors[activeScheme].tint }]}
                              numberOfLines={1}>
                              {formatDays(w.daysOfWeek)}
                            </Text>
                          </View>
                          {dueIndicator && duePresentation ? (
                            <View
                              style={[styles.workoutDueBadge, { backgroundColor: duePresentation.backgroundColor }]}
                              lightColor="transparent"
                              darkColor="transparent">
                              <Ionicons
                                name={workoutDueIcon(dueIndicator.tone)}
                                size={14}
                                color={duePresentation.color}
                              />
                              <Text
                                style={[styles.workoutDueLabel, { color: duePresentation.color }]}
                                numberOfLines={1}>
                                {dueIndicator.label}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.workoutSummary} lightColor="transparent" darkColor="transparent">
                          <Text style={[styles.workoutSummaryCount, { color: textColor }]}>{summary.countLine}</Text>
                          {summary.previewLine ? (
                            <Text style={[styles.workoutSummaryPreview, { color: mutedTextColor }]} numberOfLines={2}>
                              {summary.previewLine}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.workoutMetrics} lightColor="transparent" darkColor="transparent">
                          <View style={styles.workoutMetricRow} lightColor="transparent" darkColor="transparent">
                            <Ionicons name="time-outline" size={15} color={Colors[activeScheme].tint} />
                            <Text style={[styles.workoutMetricLabel, { color: mutedTextColor }]}>Last logged</Text>
                            <Text style={[styles.workoutMetricValue, { color: textColor }]}>
                              {formatWorkoutLastLogged(logStats?.lastLoggedAt ?? null)}
                            </Text>
                          </View>
                          <View style={styles.workoutMetricRow} lightColor="transparent" darkColor="transparent">
                            <Ionicons name="repeat-outline" size={15} color={Colors[activeScheme].tint} />
                            <Text style={[styles.workoutMetricLabel, { color: mutedTextColor }]}>Logged</Text>
                            <Text style={[styles.workoutMetricValue, { color: textColor }]}>
                              {formatWorkoutSessionCount(logStats)}
                            </Text>
                          </View>
                          {trackingSince ? (
                            <View style={styles.workoutMetricRow} lightColor="transparent" darkColor="transparent">
                              <Ionicons name="calendar-outline" size={15} color={Colors[activeScheme].tint} />
                              <Text style={[styles.workoutMetricLabel, { color: mutedTextColor }]}>Tracking</Text>
                              <Text style={[styles.workoutMetricValue, { color: textColor }]}>{trackingSince}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={styles.detailLeadingActions} lightColor="transparent" darkColor="transparent">
                          {draftWorkoutIds.has(w.id) ? (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Resume draft workout log"
                              onPress={() => navigateToResumeLogWorkout(w.id)}
                              style={({ pressed }) => [
                                styles.detailPrimaryButton,
                                { backgroundColor: Colors[activeScheme].tint, opacity: pressed ? 0.85 : 1 },
                              ]}
                              hitSlop={6}>
                              <Text
                                style={[styles.detailPrimaryButtonLabel, { color: Colors[activeScheme].background }]}>
                                Resume
                              </Text>
                            </Pressable>
                          ) : null}
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Start workout"
                            onPress={() => onStartWorkout(w.id)}
                            style={({ pressed }) => [
                              styles.detailPrimaryButton,
                              { backgroundColor: Colors[activeScheme].tint, opacity: pressed ? 0.85 : 1 },
                            ]}
                            hitSlop={6}>
                            <Text
                              style={[styles.detailPrimaryButtonLabel, { color: Colors[activeScheme].background }]}>
                              Start
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </RNView>
                  );
                }}
              />
            ) : null}
          </View>
        </View>

        {hasMultipleWorkouts ? (
          <View style={styles.carouselAffordances} lightColor="transparent" darkColor="transparent">
            <View style={styles.carouselDots} lightColor="transparent" darkColor="transparent">
              {dropdownWorkouts.map((w, i) => (
                <View
                  key={w.id}
                  lightColor="transparent"
                  darkColor="transparent"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[
                    styles.carouselDot,
                    i === selectedCarouselIndex ? styles.carouselDotActive : styles.carouselDotInactive,
                    i === selectedCarouselIndex
                      ? { backgroundColor: Colors[activeScheme].tint }
                      : {
                          backgroundColor: activeScheme === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)',
                        },
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.carouselHint, { color: mutedTextColor }]}>Swipe to switch workouts</Text>
          </View>
        ) : null}
      </ScrollView>

      {isActionSheetOpen ? (
        <View
          style={styles.actionOverlay}
          pointerEvents="box-none"
          lightColor="transparent"
          darkColor="transparent">
          <Pressable style={styles.actionSheetBackdrop} onPress={() => closeActionSheet()} accessibilityRole="button" />
          <Animated.View
            style={[
              styles.actionSheet,
              {
                backgroundColor: sheetBackground,
                borderTopColor: sheetBorder,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                transform: [{ translateY: sheetTranslateY }],
              },
            ]}>
            <View style={[styles.actionSheetHandle, { backgroundColor: activeScheme === 'dark' ? '#5b5378' : '#d4d4d4' }]} />
            <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.actionSheetRowPressed]}
              accessibilityRole="button"
              accessibilityLabel="Start workout"
              onPress={() => {
                const w = selected;
                closeActionSheet(() => {
                  if (w) {
                    onStartWorkout(w.id);
                  }
                });
              }}>
              <Ionicons name="journal-outline" size={22} color="#D40078" style={styles.actionSheetIcon} />
              <Text style={[styles.actionSheetLabel, styles.log]}>Start</Text>
            </Pressable>
            {selected && draftWorkoutIds.has(selected.id) ? (
              <Pressable
                style={({ pressed }) => [styles.actionSheetRow, pressed && styles.actionSheetRowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Resume draft workout log"
                onPress={() => {
                  const w = selected;
                  closeActionSheet(() => {
                    if (w) {
                      navigateToResumeLogWorkout(w.id);
                    }
                  });
                }}>
                <Ionicons name="play-outline" size={22} color="#D40078" style={styles.actionSheetIcon} />
                <Text style={[styles.actionSheetLabel, styles.log]}>Resume</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.actionSheetRowPressed]}
              onPress={() => {
                const w = selected;
                closeActionSheet(() => {
                  if (w) {
                    router.push({ pathname: '/workout-edit', params: { id: w.id } });
                  }
                });
              }}>
              <Ionicons name="create-outline" size={22} color="#D40078" style={styles.actionSheetIcon} />
              <Text style={[styles.actionSheetLabel, styles.edit]}>Edit</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.actionSheetRowPressed]}
              onPress={() => {
                const w = selected;
                closeActionSheet(() => {
                  if (w) {
                    onCopy(w);
                  }
                });
              }}>
              <Ionicons name="copy-outline" size={22} color="#D40078" style={styles.actionSheetIcon} />
              <Text style={[styles.actionSheetLabel, styles.copy]}>Copy</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionSheetRow, pressed && styles.actionSheetRowPressed]}
              onPress={() => {
                const w = selected;
                closeActionSheet(() => {
                  if (w) {
                    onDelete(w);
                  }
                });
              }}>
              <Ionicons name="trash-outline" size={22} color="#D40078" style={styles.actionSheetIcon} />
              <Text style={[styles.actionSheetLabel, styles.delete]}>Delete</Text>
            </Pressable>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    position: 'relative',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  carouselRow: {
    width: '100%',
    zIndex: 2,
  },
  carouselTrack: {
    width: '100%',
  },
  carouselAffordances: {
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  carouselDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  carouselDotActive: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  carouselDotInactive: {
    opacity: 0.85,
  },
  carouselHint: {
    fontSize: 13,
    fontWeight: '500',
  },
  workoutCard: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  workoutCardHeader: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  workoutCardHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  workoutCardHeaderSide: {
    width: 34,
  },
  workoutTitlePressable: {
    flex: 1,
    minWidth: 0,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  workoutCardMenuButton: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderRadius: 10,
  },
  workoutTitle: {
    flexShrink: 1,
    fontSize: DROPDOWN_TITLE_FONT_SIZE,
    lineHeight: DROPDOWN_TITLE_FONT_SIZE ? DROPDOWN_TITLE_FONT_SIZE + 2 : undefined,
  },
  workoutCardHeaderDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    opacity: 0.65,
  },
  workoutCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  workoutCardBodyExpanded: {
    flex: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  scheduleDaysGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  workoutDueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    maxWidth: '58%',
  },
  workoutDueLabel: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  dropdownTextMagenta: {
    color: '#D40078',
  },
  /** Softer look for weekday vs title in dropdown rows. */
  dropdownDayFaded: {
    opacity: 0.68,
  },
  detailLeadingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    width: '100%',
    marginTop: 'auto',
  },
  detailDaysText: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  /** Compact variant of {@link StickySaveFooter} primary button. */
  detailPrimaryButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  detailPrimaryButtonLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  iconActionButtonPressed: {
    opacity: 0.55,
  },
  workoutSummary: {
    gap: 4,
  },
  workoutSummaryCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  workoutSummaryPreview: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  workoutMetrics: {
    gap: 6,
    paddingTop: 2,
  },
  workoutMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  workoutMetricLabel: {
    fontSize: 14,
    fontWeight: '500',
    width: 78,
  },
  workoutMetricValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    elevation: 50,
    justifyContent: 'flex-end',
  },
  actionSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  actionSheet: {
    width: '100%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  actionSheetHandle: {
    alignSelf: 'flex-start',
    marginLeft: 20,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  actionSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionSheetIcon: {
    width: 28,
  },
  actionSheetRowPressed: {
    opacity: 0.75,
  },
  actionSheetLabel: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'left',
  },
  log: {
    color: '#D40078',
    fontWeight: '600',
  },
  edit: {
    color: '#D40078',
    fontWeight: '600',
  },
  copy: {
    color: '#D40078',
    fontWeight: '600',
  },
  delete: {
    color: '#D40078',
    fontWeight: '600',
  },
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
});
