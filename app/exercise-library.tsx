import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import { ExerciseDraftFieldsEditor, type ExerciseDraftField } from '@/components/ExerciseDraftFieldsEditor';
import Colors from '@/constants/Colors';
import { stackHeaderHideIosBackLabel } from '@/constants/stackHeader';
import { useColorScheme } from '@/components/useColorScheme';
import { activityTypeLabel, formatPlannedExerciseSummary } from '@/lib/exerciseDisplay';
import {
  formatCardioDistanceValue,
} from '@/lib/cardioDistanceUnits';
import { formatDurationValue } from '@/lib/durationUnits';
import {
  applyActivityTypeChangeToDraftRow,
  applyCardioDistanceTrackingChangeToDraftRow,
  applyCardioDurationTrackingChangeToDraftRow,
  applyCardioObjectiveChangeToDraftRow,
  parseWorkoutExerciseFromDraft,
  workoutExerciseToDraftRow,
  type ExerciseDraftRow,
  type ExerciseDraftSeed,
} from '@/lib/exerciseDraft';
import {
  DEFAULT_CARDIO_DISTANCE_TRACKING,
  DEFAULT_CARDIO_DURATION_TRACKING,
  DEFAULT_CARDIO_OBJECTIVE,
} from '@/lib/cardioPlan';
import { normalizeWorkoutIconId, type WorkoutIconId } from '@/lib/workoutIcons';
import {
  loadWorkouts,
  removeExercisesMatchingSignatureFromAllWorkouts,
  updateExercisesMatchingSignatureAcrossWorkouts,
} from '@/lib/workoutsStorage';
import { themedAlert } from '@/lib/themedAlert';
import { DAYS_OF_WEEK, type DayOfWeek, type WorkoutExercise } from '@/lib/types';

type RouteSource = 'create' | 'edit';
type ExerciseListItem = Pick<
  WorkoutExercise,
  'id' | 'activityType' | 'name' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode' | 'score' | 'scoreUnit'
> & { key: string };
type CreateDraftPayload = { title: string; daysOfWeek: DayOfWeek[]; iconId: WorkoutIconId };
type ImportExercisesPayload = {
  nonce: string;
  exercises: ExerciseDraftSeed[];
  createDraft?: CreateDraftPayload;
};

const EXERCISE_LIBRARY_EDIT_IMPACT =
  'Editing changes this exercise everywhere it appears in your workouts. Saved logs that include it will be updated, which may change metrics.\n\nContinue?';

const EXERCISE_LIBRARY_DELETE_IMPACT =
  'Deleting removes this exercise from all workouts and from saved logs that include it. Metrics and history that reference it will change.\n\nDelete anyway?';

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
  const { source, workoutId, existingExercises, createDraft, libraryEntry } = useLocalSearchParams<{
    source?: RouteSource;
    workoutId?: string | string[];
    existingExercises?: string | string[];
    createDraft?: string | string[];
    libraryEntry?: string | string[];
  }>();
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ExerciseListItem[]>([]);
  /** Selected exercise ids (`WorkoutExercise.id`) for multi-select. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  /** Browse-only: baseline row when the edit modal is open. */
  const [editBaseline, setEditBaseline] = useState<ExerciseListItem | null>(null);
  const [editDraft, setEditDraft] = useState<ExerciseDraftRow | null>(null);
  const [libraryMutationBusy, setLibraryMutationBusy] = useState(false);

  const reloadLibrary = useCallback(async () => {
    setLoading(true);
    const workouts = await loadWorkouts();
    const unique = new Map<string, ExerciseListItem>();
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const key = `${exercise.activityType}|${exercise.name}|${exercise.sets}|${exercise.reps}|${exercise.weight}|${exercise.weightUnit}|${exercise.duration}|${exercise.durationUnit}|${exercise.distance}|${exercise.distanceUnit}|${exercise.cardioObjective}|${exercise.cardioDurationTracking}|${exercise.cardioDistanceTracking}|${exercise.score}|${exercise.scoreUnit}`;
        if (!unique.has(key)) {
          unique.set(key, {
            key,
            id: exercise.id,
            activityType: exercise.activityType,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weight: exercise.weight,
            weightUnit: exercise.weightUnit,
            duration: exercise.duration,
            durationUnit: exercise.durationUnit,
            distance: exercise.distance,
            distanceUnit: exercise.distanceUnit,
            cardioObjective: exercise.cardioObjective,
            cardioDurationTracking: exercise.cardioDurationTracking,
            cardioDistanceTracking: exercise.cardioDistanceTracking,
            cardioDistanceMode: exercise.cardioDistanceMode,
            score: exercise.score,
            scoreUnit: exercise.scoreUnit,
          });
        }
      }
    }
    setItems([...unique.values()].sort((a, b) => a.name.localeCompare(b.name)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reloadLibrary();
  }, [reloadLibrary]);

  const normalizedWorkoutId = useMemo(() => (Array.isArray(workoutId) ? workoutId[0] : workoutId), [workoutId]);
  const normalizedExistingExercises = useMemo(
    () => (Array.isArray(existingExercises) ? existingExercises[0] : existingExercises),
    [existingExercises],
  );

  const normalizedLibraryEntry = useMemo(
    () => (Array.isArray(libraryEntry) ? libraryEntry[0] : libraryEntry),
    [libraryEntry],
  );
  /** Opened from Create/Edit header ⋮ menu: read-only list, no hint/footer. */
  const browseOnly = normalizedLibraryEntry === 'menu';

  const textColor = Colors[activeScheme].text;
  const draftBorderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const draftInputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';
  const exerciseNameInputStyle = useMemo(
    () => [styles.draftExerciseInput, { color: textColor, borderColor: draftBorderColor, backgroundColor: draftInputBackground }],
    [textColor, draftBorderColor, draftInputBackground],
  );
  const setRowInputStyle = useMemo(
    () => [
      styles.draftExerciseInput,
      styles.draftSetInput,
      styles.draftUnitInput,
      { color: textColor, borderColor: draftBorderColor, backgroundColor: draftInputBackground },
    ],
    [textColor, draftBorderColor, draftInputBackground],
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

  const openEditFormForItem = useCallback((item: ExerciseListItem) => {
    setEditBaseline(item);
    setEditDraft(workoutExerciseToDraftRow(item, { clientId: item.id }));
  }, []);

  const closeEditForm = useCallback(() => {
    setEditBaseline(null);
    setEditDraft(null);
  }, []);

  const updateEditDraftField = useCallback((field: ExerciseDraftField, value: string) => {
    setEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const requestEditExercise = useCallback(
    (item: ExerciseListItem) => {
      themedAlert('Edit exercise?', EXERCISE_LIBRARY_EDIT_IMPACT, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => openEditFormForItem(item) },
      ]);
    },
    [openEditFormForItem],
  );

  const requestDeleteExercise = useCallback(
    (item: ExerciseListItem) => {
      themedAlert('Delete exercise?', EXERCISE_LIBRARY_DELETE_IMPACT, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setLibraryMutationBusy(true);
                await removeExercisesMatchingSignatureFromAllWorkouts({
                  activityType: item.activityType,
                  name: item.name,
                  sets: item.sets,
                  reps: item.reps,
                  weight: item.weight,
                  weightUnit: item.weightUnit,
                  duration: item.duration,
                  durationUnit: item.durationUnit,
                  distance: item.distance,
                  distanceUnit: item.distanceUnit,
                  cardioObjective: item.cardioObjective,
                  cardioDurationTracking: item.cardioDurationTracking,
                  cardioDistanceTracking: item.cardioDistanceTracking,
                  cardioDistanceMode: item.cardioDistanceMode,
                  score: item.score,
                  scoreUnit: item.scoreUnit,
                });
                await reloadLibrary();
              } finally {
                setLibraryMutationBusy(false);
              }
            })();
          },
        },
      ]);
    },
    [reloadLibrary],
  );

  const saveEditedExercise = useCallback(async () => {
    if (!editBaseline || !editDraft) {
      return;
    }
    const parsed = parseWorkoutExerciseFromDraft(editDraft, editBaseline.id);
    if (!parsed.ok) {
      themedAlert(parsed.title, parsed.message);
      return;
    }
    try {
      setLibraryMutationBusy(true);
      await updateExercisesMatchingSignatureAcrossWorkouts(
        {
          activityType: editBaseline.activityType,
          name: editBaseline.name,
          sets: editBaseline.sets,
          reps: editBaseline.reps,
          weight: editBaseline.weight,
          weightUnit: editBaseline.weightUnit,
          duration: editBaseline.duration,
          durationUnit: editBaseline.durationUnit,
          distance: editBaseline.distance,
          distanceUnit: editBaseline.distanceUnit,
          cardioObjective: editBaseline.cardioObjective,
          cardioDurationTracking: editBaseline.cardioDurationTracking,
          cardioDistanceTracking: editBaseline.cardioDistanceTracking,
          cardioDistanceMode: editBaseline.cardioDistanceMode,
          score: editBaseline.score,
          scoreUnit: editBaseline.scoreUnit,
        },
        parsed.exercise,
      );
      closeEditForm();
      await reloadLibrary();
    } finally {
      setLibraryMutationBusy(false);
    }
  }, [editBaseline, editDraft, reloadLibrary, closeEditForm]);

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
      activityType: exercise.activityType,
      name: exercise.name,
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      weight: String(exercise.weight),
      weightUnit: exercise.weightUnit,
      duration: exercise.duration > 0 ? formatDurationValue(exercise.duration, exercise.durationUnit) : '',
      durationUnit: exercise.durationUnit,
      distance: exercise.distance > 0 ? formatCardioDistanceValue(exercise.distance, exercise.distanceUnit) : '',
      distanceUnit: exercise.distanceUnit,
      cardioObjective: exercise.cardioObjective ?? DEFAULT_CARDIO_OBJECTIVE,
      cardioDurationTracking: exercise.cardioDurationTracking ?? DEFAULT_CARDIO_DURATION_TRACKING,
      cardioDistanceTracking: exercise.cardioDistanceTracking ?? DEFAULT_CARDIO_DISTANCE_TRACKING,
      score: exercise.score,
      scoreUnit: exercise.scoreUnit,
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
            !browseOnly && selectedCount > 0 ? (
              <Pressable onPress={() => setSelectedIds(new Set())} style={styles.headerClear} hitSlop={12}>
                <Text style={[styles.headerClearLabel, { color: tint }]}>Clear</Text>
              </Pressable>
            ) : null,
          ...stackHeaderHideIosBackLabel,
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
            contentContainerStyle={
              browseOnly
                ? [styles.list, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]
                : styles.list
            }
            ListHeaderComponent={
              browseOnly ? null : (
                <Text style={[styles.hint, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                  Tap exercises to select them, then add them to your workout.
                </Text>
              )
            }
            renderItem={({ item }) => {
              if (browseOnly) {
                const borderColor = activeScheme === 'dark' ? '#333' : '#e5e5e5';
                const disabled = libraryMutationBusy;
                return (
                  <RNView
                    style={[
                      styles.card,
                      styles.cardRowBrowse,
                      { borderColor, opacity: disabled ? 0.65 : 1 },
                    ]}
                    accessibilityRole="text"
                    accessibilityLabel={`${item.name}, ${activityTypeLabel(item.activityType)}, ${formatPlannedExerciseSummary(item)}`}>
                    <View
                      style={[styles.cardText, styles.cardTextBrowse]}
                      lightColor="transparent"
                      darkColor="transparent">
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      <Text style={styles.meta}>{activityTypeLabel(item.activityType)} · {formatPlannedExerciseSummary(item)}</Text>
                    </View>
                    <RNView style={styles.cardRowActions}>
                      <Pressable
                        disabled={disabled}
                        onPress={() => requestEditExercise(item)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Edit exercise"
                        style={({ pressed }) => [styles.cardRowIconBtn, pressed && styles.cardRowIconBtnPressed]}>
                        <Ionicons name="pencil-outline" size={22} color={tint} />
                      </Pressable>
                      <Pressable
                        disabled={disabled}
                        onPress={() => requestDeleteExercise(item)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Delete exercise"
                        style={({ pressed }) => [styles.cardRowIconBtn, pressed && styles.cardRowIconBtnPressed]}>
                        <Ionicons name="trash-outline" size={22} color="#ef4444" />
                      </Pressable>
                    </RNView>
                  </RNView>
                );
              }
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
                    <Text style={styles.meta}>{activityTypeLabel(item.activityType)} · {formatPlannedExerciseSummary(item)}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
          {!browseOnly ? (
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
          ) : null}
        </>
      )}
      <Modal
        visible={editDraft !== null}
        animationType="fade"
        transparent
        onRequestClose={closeEditForm}>
        <RNView style={styles.modalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, styles.modalDim]}
            onPress={closeEditForm}
            accessibilityRole="button"
            accessibilityLabel="Close edit form"
          />
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: 'padding', android: 'height' })}
            keyboardVerticalOffset={Platform.select({ ios: 80, android: 24 })}
            style={[StyleSheet.absoluteFillObject, styles.modalCenterWrap]}
            pointerEvents="box-none">
            <View style={[styles.draftExerciseCard, { borderColor: draftBorderColor }]}>
              <RNView style={styles.draftCardHeader}>
                <Text style={[styles.draftCardHeading, styles.draftCardHeaderTitle]} numberOfLines={1}>
                  Exercise
                </Text>
                <RNView style={styles.draftCardHeaderActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close without saving"
                    onPress={closeEditForm}
                    disabled={libraryMutationBusy}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.draftHeaderIconPressable,
                      pressed && styles.cardRowIconBtnPressed,
                    ]}>
                    <Ionicons name="close-outline" size={26} color={textColor} />
                  </Pressable>
                </RNView>
              </RNView>
              {editDraft ? (
                <ExerciseDraftFieldsEditor
                  draft={editDraft}
                  disabled={libraryMutationBusy}
                  activeScheme={activeScheme}
                  borderColor={draftBorderColor}
                  textColor={textColor}
                  exerciseNameInputStyle={exerciseNameInputStyle}
                  setRowInputStyle={setRowInputStyle}
                  onActivityTypeChange={(activityType) =>
                    setEditDraft((prev) => (prev ? applyActivityTypeChangeToDraftRow(prev, activityType) : prev))
                  }
                  onNameChange={(name) => setEditDraft((prev) => (prev ? { ...prev, name } : prev))}
                  onFieldChange={updateEditDraftField}
                  onDistanceUnitChange={(unit) => setEditDraft((prev) => (prev ? { ...prev, distanceUnit: unit } : prev))}
                  onCardioObjectiveChange={(objective) =>
                    setEditDraft((prev) => (prev ? applyCardioObjectiveChangeToDraftRow(prev, objective) : prev))
                  }
                  onCardioDurationTrackingChange={(tracking) =>
                    setEditDraft((prev) => (prev ? applyCardioDurationTrackingChangeToDraftRow(prev, tracking) : prev))
                  }
                  onCardioDistanceTrackingChange={(tracking) =>
                    setEditDraft((prev) => (prev ? applyCardioDistanceTrackingChangeToDraftRow(prev, tracking) : prev))
                  }
                  onDurationUnitChange={(unit) => setEditDraft((prev) => (prev ? { ...prev, durationUnit: unit } : prev))}
                  onScoreUnitChange={(unit) => setEditDraft((prev) => (prev ? { ...prev, scoreUnit: unit } : prev))}
                  onWeightUnitChange={(unit) => setEditDraft((prev) => (prev ? { ...prev, weightUnit: unit } : prev))}
                />
              ) : null}
              <Pressable
                onPress={() => void saveEditedExercise()}
                disabled={libraryMutationBusy}
                style={[
                  styles.draftModalPrimaryButton,
                  { backgroundColor: libraryMutationBusy ? (activeScheme === 'dark' ? '#404040' : '#a3a3a3') : tint },
                ]}>
                <Text style={[styles.draftModalPrimaryButtonLabel, { color: Colors[activeScheme].background }]}>
                  Save
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </RNView>
      </Modal>
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
  cardRowBrowse: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTextBrowse: {
    flex: 1,
    minWidth: 0,
  },
  cardRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  cardRowIconBtn: {
    padding: 6,
  },
  cardRowIconBtnPressed: {
    opacity: 0.55,
  },
  modalRoot: {
    flex: 1,
  },
  modalDim: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCenterWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  draftExerciseCard: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  draftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
  },
  draftCardHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  draftCardHeaderTitle: {
    flex: 1,
    minWidth: 0,
    maxWidth: '44%',
  },
  draftCardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    zIndex: 2,
  },
  draftHeaderIconPressable: {
    padding: 4,
  },
  draftExerciseInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  draftSetInput: {
    flexGrow: 1,
    minWidth: 80,
  },
  draftUnitInput: {
    paddingRight: 34,
  },
  draftModalPrimaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  draftModalPrimaryButtonLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
});
