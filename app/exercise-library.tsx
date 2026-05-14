import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View as RNView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { normalizeWorkoutIconId, type WorkoutIconId } from '@/lib/workoutIcons';
import {
  loadWorkouts,
  removeExercisesMatchingSignatureFromAllWorkouts,
  updateExercisesMatchingSignatureAcrossWorkouts,
} from '@/lib/workoutsStorage';
import { DAYS_OF_WEEK, type DayOfWeek, type WorkoutExercise } from '@/lib/types';

type RouteSource = 'create' | 'edit';
type ExerciseListItem = Pick<WorkoutExercise, 'id' | 'name' | 'sets' | 'reps' | 'weightKg'> & { key: string };
type ExerciseDraftSeed = { sourceExerciseId?: string; name: string; sets: string; reps: string; weightKg: string };
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
  const [editName, setEditName] = useState('');
  const [editSets, setEditSets] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [libraryMutationBusy, setLibraryMutationBusy] = useState(false);

  const reloadLibrary = useCallback(async () => {
    setLoading(true);
    const workouts = await loadWorkouts();
    const unique = new Map<string, ExerciseListItem>();
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        const key = `${exercise.name}|${exercise.sets}|${exercise.reps}|${exercise.weightKg}`;
        if (!unique.has(key)) {
          unique.set(key, {
            key,
            id: exercise.id,
            name: exercise.name,
            sets: exercise.sets,
            reps: exercise.reps,
            weightKg: exercise.weightKg,
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
    setEditName(item.name);
    setEditSets(String(item.sets));
    setEditReps(String(item.reps));
    setEditWeight(String(item.weightKg));
  }, []);

  const closeEditForm = useCallback(() => {
    setEditBaseline(null);
  }, []);

  const requestEditExercise = useCallback(
    (item: ExerciseListItem) => {
      Alert.alert('Edit exercise?', EXERCISE_LIBRARY_EDIT_IMPACT, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => openEditFormForItem(item) },
      ]);
    },
    [openEditFormForItem],
  );

  const requestDeleteExercise = useCallback(
    (item: ExerciseListItem) => {
      Alert.alert('Delete exercise?', EXERCISE_LIBRARY_DELETE_IMPACT, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                setLibraryMutationBusy(true);
                await removeExercisesMatchingSignatureFromAllWorkouts({
                  name: item.name,
                  sets: item.sets,
                  reps: item.reps,
                  weightKg: item.weightKg,
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
    if (!editBaseline) {
      return;
    }
    const name = editName.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter an exercise name.');
      return;
    }
    const sets = Number.parseInt(editSets.trim(), 10);
    const reps = Number.parseInt(editReps.trim(), 10);
    const weightKg = Number.parseFloat(editWeight.trim());
    if (!Number.isFinite(sets) || sets < 1) {
      Alert.alert('Invalid sets', 'Enter a whole number of sets (at least 1).');
      return;
    }
    if (!Number.isFinite(reps) || reps < 1) {
      Alert.alert('Invalid reps', 'Enter a whole number of reps (at least 1).');
      return;
    }
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      Alert.alert('Invalid weight', 'Enter a valid weight (0 or more).');
      return;
    }
    try {
      setLibraryMutationBusy(true);
      await updateExercisesMatchingSignatureAcrossWorkouts(
        {
          name: editBaseline.name,
          sets: editBaseline.sets,
          reps: editBaseline.reps,
          weightKg: editBaseline.weightKg,
        },
        { name, sets, reps, weightKg },
      );
      closeEditForm();
      await reloadLibrary();
    } finally {
      setLibraryMutationBusy(false);
    }
  }, [editBaseline, editName, editSets, editReps, editWeight, reloadLibrary, closeEditForm]);

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
      name: exercise.name,
      sets: String(exercise.sets),
      reps: String(exercise.reps),
      weightKg: String(exercise.weightKg),
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
                    accessibilityLabel={`${item.name}, ${item.sets} set${item.sets === 1 ? '' : 's'}, ${item.reps} reps, ${item.weightKg} lb`}>
                    <View
                      style={[styles.cardText, styles.cardTextBrowse]}
                      lightColor="transparent"
                      darkColor="transparent">
                      <Text style={styles.exerciseName}>{item.name}</Text>
                      <Text style={styles.meta}>
                        {item.sets} set{item.sets === 1 ? '' : 's'} x {item.reps} reps @ {item.weightKg} lb
                      </Text>
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
                    <Text style={styles.meta}>
                      {item.sets} set{item.sets === 1 ? '' : 's'} x {item.reps} reps @ {item.weightKg} lb
                    </Text>
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
        visible={editBaseline !== null}
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
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Exercise name"
                placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                editable={!libraryMutationBusy}
                style={exerciseNameInputStyle}
              />
              <RNView style={styles.draftSetRow}>
                <View style={styles.draftUnitInputWrap} lightColor="transparent" darkColor="transparent">
                  <TextInput
                    value={editSets}
                    onChangeText={setEditSets}
                    placeholder="0"
                    keyboardType="number-pad"
                    placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                    editable={!libraryMutationBusy}
                    style={setRowInputStyle}
                  />
                  <Text
                    style={[styles.draftUnitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}
                    lightColor="transparent"
                    darkColor="transparent">
                    sets
                  </Text>
                </View>
                <View style={styles.draftUnitInputWrap} lightColor="transparent" darkColor="transparent">
                  <TextInput
                    value={editReps}
                    onChangeText={setEditReps}
                    placeholder="0"
                    keyboardType="number-pad"
                    placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                    editable={!libraryMutationBusy}
                    style={setRowInputStyle}
                  />
                  <Text
                    style={[styles.draftUnitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}
                    lightColor="transparent"
                    darkColor="transparent">
                    reps
                  </Text>
                </View>
                <View style={styles.draftUnitInputWrap} lightColor="transparent" darkColor="transparent">
                  <TextInput
                    value={editWeight}
                    onChangeText={setEditWeight}
                    placeholder="0"
                    keyboardType="decimal-pad"
                    placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                    editable={!libraryMutationBusy}
                    style={setRowInputStyle}
                  />
                  <Text
                    style={[styles.draftUnitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}
                    lightColor="transparent"
                    darkColor="transparent">
                    lb
                  </Text>
                </View>
              </RNView>
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
  draftSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  draftUnitInputWrap: {
    flexGrow: 1,
    minWidth: 80,
    position: 'relative',
  },
  draftUnitSuffix: {
    position: 'absolute',
    right: 12,
    top: 10,
    fontSize: 16,
    fontWeight: '600',
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
