import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useTheme } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { pickWorkoutIdForDeviceCalendarDay, sortWorkoutsForDropdown } from '@/lib/deviceDayOfWeek';
import { deleteLoggedWorkoutsByWorkoutId, deleteWorkout, loadWorkouts } from '@/lib/workoutsStorage';
import { DAYS_OF_WEEK, DAY_OF_WEEK_ABBREVIATIONS, type Workout } from '@/lib/types';

/** Matches `@react-navigation/elements` `HeaderTitle` (Workouts screen title). */
const DROPDOWN_TITLE_FONT_SIZE = Platform.select({ ios: 17, android: 20, default: 18 });

const ACTION_SHEET_SLIDE = 320;
type CopyWorkoutPayload = Pick<Workout, 'title' | 'daysOfWeek' | 'iconId'> & {
  exercises: Array<Pick<Workout['exercises'][number], 'id' | 'name' | 'sets' | 'reps' | 'weightKg'>>;
};

export function WorkoutsList() {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [detailWidth, setDetailWidth] = useState(0);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(ACTION_SHEET_SLIDE)).current;
  const carouselRef = useRef<FlatList<Workout>>(null);
  const detailRef = useRef<FlatList<Workout>>(null);

  const textColor = Colors[activeScheme].text;
  /** Carousel page border when not selected. */
  const borderColor = '#d4d4d4';
  /** Exercises card: dark tint (`#23D5D5`) in dark mode, neutral in light. */
  const detailBorderColor = activeScheme === 'dark' ? Colors.dark.tint : '#d4d4d4';
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
        const next = await loadWorkouts();
        if (!cancelled) {
          setWorkouts(next);
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

  const selectedCarouselIndex = useMemo(
    () => dropdownWorkouts.findIndex((w) => w.id === selectedId),
    [dropdownWorkouts, selectedId],
  );
  const hasMultipleWorkouts = dropdownWorkouts.length > 1;

  const onCarouselLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) {
      setCarouselWidth((prev) => (Math.abs(next - prev) < 0.5 ? prev : next));
    }
  }, []);

  const scrollCarouselToWorkoutId = useCallback(
    (id: string | null, animated: boolean) => {
      if (!id || carouselWidth <= 0) {
        return;
      }
      const index = dropdownWorkouts.findIndex((w) => w.id === id);
      if (index < 0) {
        return;
      }
      carouselRef.current?.scrollToOffset({ offset: index * carouselWidth, animated });
    },
    [carouselWidth, dropdownWorkouts],
  );

  const onDetailLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0) {
      setDetailWidth((prev) => (Math.abs(next - prev) < 0.5 ? prev : next));
    }
  }, []);

  const scrollDetailToWorkoutId = useCallback(
    (id: string | null, animated: boolean) => {
      if (!id || detailWidth <= 0) {
        return;
      }
      const index = dropdownWorkouts.findIndex((w) => w.id === id);
      if (index < 0) {
        return;
      }
      detailRef.current?.scrollToOffset({ offset: index * detailWidth, animated });
    },
    [detailWidth, dropdownWorkouts],
  );

  useEffect(() => {
    scrollCarouselToWorkoutId(selectedId, false);
    scrollDetailToWorkoutId(selectedId, false);
  }, [selectedId, scrollCarouselToWorkoutId, scrollDetailToWorkoutId]);

  const onCarouselMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (carouselWidth <= 0 || dropdownWorkouts.length === 0) {
        return;
      }
      const page = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
      const idx = Math.max(0, Math.min(dropdownWorkouts.length - 1, page));
      const next = dropdownWorkouts[idx];
      if (next && next.id !== selectedId) {
        setSelectedId(next.id);
      }
    },
    [carouselWidth, dropdownWorkouts, selectedId],
  );

  const onDetailMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (detailWidth <= 0 || dropdownWorkouts.length === 0) {
        return;
      }
      const page = Math.round(event.nativeEvent.contentOffset.x / detailWidth);
      const idx = Math.max(0, Math.min(dropdownWorkouts.length - 1, page));
      const next = dropdownWorkouts[idx];
      if (next && next.id !== selectedId) {
        setSelectedId(next.id);
      }
    },
    [detailWidth, dropdownWorkouts, selectedId],
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

  const onDelete = (workout: Workout) => {
    Alert.alert(
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
            const updated = await loadWorkouts();
            setWorkouts(updated);
            setSelectedId((prev) => pickWorkoutIdForDeviceCalendarDay(updated, prev === id ? null : prev));
          })();
        },
      },
    ],
    );
  };

  const onCopy = (workout: Workout) => {
    const payload: CopyWorkoutPayload = {
      title: workout.title,
      daysOfWeek: workout.daysOfWeek,
      iconId: workout.iconId,
      exercises: workout.exercises.map((ex) => ({
        id: ex.id,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weightKg: ex.weightKg,
      })),
    };

    router.push({ pathname: '/workouts', params: { copyWorkout: JSON.stringify(payload) } });
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
          <View style={styles.carouselTrack} onLayout={onCarouselLayout}>
            {carouselWidth > 0 ? (
              <FlatList
                  ref={carouselRef}
                  data={dropdownWorkouts}
                  keyExtractor={(w) => w.id}
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  removeClippedSubviews={false}
                  showsHorizontalScrollIndicator={hasMultipleWorkouts}
                  keyboardShouldPersistTaps="handled"
                  extraData={selectedId}
                  onMomentumScrollEnd={onCarouselMomentumEnd}
                getItemLayout={(_, index) => ({
                  length: carouselWidth,
                  offset: carouselWidth * index,
                  index,
                })}
                renderItem={({ item: w, index }) => {
                  const isSelected = w.id === selectedId;
                  return (
                    <Pressable
                      onPress={() => {
                        setSelectedId(w.id);
                        carouselRef.current?.scrollToOffset({
                          offset: index * carouselWidth,
                          animated: true,
                        });
                      }}
                      style={[
                        styles.carouselPage,
                        { width: carouselWidth, borderColor: isSelected ? Colors[activeScheme].tint : borderColor },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={w.title}>
                      <View style={styles.carouselPageInner} lightColor="transparent" darkColor="transparent">
                        <View style={styles.carouselTitleRow} lightColor="transparent" darkColor="transparent">
                          <WorkoutIconGlyph iconId={w.iconId} size={22} color="#D40078" />
                          <Text
                            style={[styles.carouselTitle, styles.dropdownTextMagenta, headerTitleFontStyle]}
                            numberOfLines={1}>
                            {w.title}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
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
          </View>
        ) : null}

        <View style={styles.detailTrack} onLayout={onDetailLayout}>
          {detailWidth > 0 ? (
            <FlatList
              ref={detailRef}
              data={dropdownWorkouts}
              keyExtractor={(w) => w.id}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              removeClippedSubviews={false}
              showsHorizontalScrollIndicator={hasMultipleWorkouts}
              keyboardShouldPersistTaps="handled"
              extraData={selectedId}
              onMomentumScrollEnd={onDetailMomentumEnd}
              contentContainerStyle={styles.detailListContent}
              getItemLayout={(_, index) => ({
                length: detailWidth,
                offset: detailWidth * index,
                index,
              })}
              renderItem={({ item: w, index }) => {
                const isSelected = w.id === selectedId;
                return (
                  <RNView style={[styles.detailPageWrap, { width: detailWidth }]}>
                    <RNView
                      style={[
                        styles.detail,
                        {
                          borderColor: detailBorderColor,
                          backgroundColor: Colors[activeScheme].background,
                        },
                      ]}>
                      <View style={styles.detailActionsRow} lightColor="transparent" darkColor="transparent">
                        <View style={styles.detailDaysRow} lightColor="transparent" darkColor="transparent">
                          <Ionicons name="calendar-outline" size={16} color={Colors[activeScheme].tint} />
                          <Text style={[styles.detailDaysText, { color: Colors[activeScheme].tint }]}>
                            {formatDays(w.daysOfWeek)}
                          </Text>
                        </View>
                        <View style={styles.detailTrailingActions} lightColor="transparent" darkColor="transparent">
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Start workout"
                            onPress={() => router.push({ pathname: '/add', params: { workoutId: w.id } })}
                            style={({ pressed }) => [styles.iconActionButton, pressed && styles.iconActionButtonPressed]}
                            hitSlop={10}>
                            <Text style={[styles.detailStartButtonLabel, styles.dropdownTextMagenta]}>Start</Text>
                          </Pressable>
                          <Pressable
                            accessibilityLabel="Workout actions"
                            onPress={() => {
                              if (!isSelected) {
                                setSelectedId(w.id);
                                carouselRef.current?.scrollToOffset({
                                  offset: index * carouselWidth,
                                  animated: true,
                                });
                                detailRef.current?.scrollToOffset({
                                  offset: index * detailWidth,
                                  animated: true,
                                });
                              }
                              openActionSheet();
                            }}
                            style={({ pressed }) => [styles.iconActionButton, pressed && styles.iconActionButtonPressed]}
                            hitSlop={10}>
                            <Ionicons name="ellipsis-vertical" size={22} color={Colors[activeScheme].tint} />
                          </Pressable>
                        </View>
                      </View>
                      <View style={styles.detailExerciseList}>
                        {w.exercises.map((ex) => (
                          <View key={ex.id} style={styles.exerciseBlock}>
                            <Text style={[styles.exerciseName, { color: textColor }]}>{ex.name}</Text>
                            <Text style={[styles.setLine, { color: textColor }]}>
                              {ex.sets} set{ex.sets === 1 ? '' : 's'} × {ex.reps} reps @ {ex.weightKg} lb
                            </Text>
                          </View>
                        ))}
                      </View>
                    </RNView>
                  </RNView>
                );
              }}
            />
          ) : null}
        </View>
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
              accessibilityLabel="Log workout"
              onPress={() => {
                const w = selected;
                closeActionSheet(() => {
                  if (w) {
                    router.push({ pathname: '/add', params: { workoutId: w.id } });
                  }
                });
              }}>
              <Ionicons name="journal-outline" size={22} color="#D40078" style={styles.actionSheetIcon} />
              <Text style={[styles.actionSheetLabel, styles.log]}>Log</Text>
            </Pressable>
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
    minHeight: 88,
  },
  carouselAffordances: {
    alignItems: 'center',
    marginTop: 6,
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
  carouselPage: {
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  carouselPageInner: {
    alignItems: 'center',
  },
  carouselTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  carouselTitle: {
    flexShrink: 1,
    fontSize: DROPDOWN_TITLE_FONT_SIZE,
    lineHeight: DROPDOWN_TITLE_FONT_SIZE ? DROPDOWN_TITLE_FONT_SIZE + 2 : undefined,
  },
  dropdownTextMagenta: {
    color: '#D40078',
  },
  /** Softer look for weekday vs title in dropdown rows. */
  dropdownDayFaded: {
    opacity: 0.68,
  },
  detail: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    gap: 10,
    width: '100%',
  },
  detailTrack: {
    width: '100%',
  },
  detailListContent: {
    alignItems: 'flex-start',
  },
  detailPageWrap: {
    alignSelf: 'flex-start',
  },
  detailActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 2,
  },
  detailDaysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    flex: 1,
  },
  detailDaysText: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  detailTrailingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  iconActionButton: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  iconActionButtonPressed: {
    opacity: 0.55,
  },
  detailStartButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailExerciseList: {
    gap: 10,
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
  exerciseBlock: {
    gap: 2,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
  },
  setLine: {
    fontSize: 14,
    opacity: 0.9,
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
