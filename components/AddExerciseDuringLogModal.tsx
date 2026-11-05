import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View as RNView,
  type KeyboardEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseDraftFieldsEditor, type ExerciseDraftField } from '@/components/ExerciseDraftFieldsEditor';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import type { CardioDistanceTracking, CardioDurationTracking, CardioObjective } from '@/lib/cardioPlan';
import type { DurationUnit } from '@/lib/durationUnits';
import {
  applyActivityTypeChangeToDraftRow,
  applyCardioDistanceTrackingChangeToDraftRow,
  applyCardioDurationTrackingChangeToDraftRow,
  applyCardioObjectiveChangeToDraftRow,
  emptyExerciseDraftRow,
  parseWorkoutExerciseFromDraft,
  type ExerciseDraftRow,
} from '@/lib/exerciseDraft';
import { newId } from '@/lib/ids';
import type { RestDurationUnit } from '@/lib/restBetweenSets';
import type { ScoreUnit } from '@/lib/scoreUnits';
import { themedAlert } from '@/lib/themedAlert';
import type { WorkoutExercise } from '@/lib/types';
import type { WeightUnit } from '@/lib/weightUnits';

export const ADD_TO_WORKOUT_LABEL = 'Add To Future Workouts';
export const ADD_TO_WORKOUT_HELP =
  'Checked exercises show up the next time you log this workout. Unchecked exercises stay on this session and its log only. They still count in exercise metrics.';

type Props = {
  visible: boolean;
  activeScheme: 'light' | 'dark';
  onClose: () => void;
  onAdd: (exercise: WorkoutExercise, addToWorkout: boolean) => void;
};

export function AddExerciseDuringLogModal({ visible, activeScheme, onClose, onAdd }: Props) {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, initialWindowMetrics?.insets.bottom ?? 0);
  const topInset = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);
  const rootRef = useRef<RNView>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const animatedLift = useRef(new Animated.Value(0)).current;
  const [keyboardLift, setKeyboardLift] = useState(0);
  const [rootHeight, setRootHeight] = useState(0);
  const [draft, setDraft] = useState<ExerciseDraftRow>(() => emptyExerciseDraftRow());
  const [addToWorkout, setAddToWorkout] = useState(true);
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const inputBackground = activeScheme === 'dark' ? '#171717' : '#fafafa';
  const tint = Colors[activeScheme].tint;

  const applyKeyboardLift = useCallback(
    (next: number, duration: number) => {
      setKeyboardLift((current) => (Math.abs(current - next) < 1 ? current : next));
      Animated.timing(animatedLift, {
        toValue: next,
        duration,
        useNativeDriver: false,
      }).start();
    },
    [animatedLift],
  );

  const syncKeyboardLift = useCallback(
    (duration: number) => {
      const keyboardTop = keyboardTopRef.current;
      const node = rootRef.current;
      if (keyboardTop == null || node == null) {
        applyKeyboardLift(0, duration);
        return;
      }
      node.measureInWindow((_x, y, _width, height) => {
        if (height <= 0) {
          return;
        }
        applyKeyboardLift(Math.max(0, y + height - keyboardTop), duration);
      });
    },
    [applyKeyboardLift],
  );

  useEffect(() => {
    if (visible) {
      setDraft(emptyExerciseDraftRow());
      setAddToWorkout(true);
      return;
    }
    keyboardTopRef.current = null;
    applyKeyboardLift(0, 0);
  }, [visible, applyKeyboardLift]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    let resyncTimer: ReturnType<typeof setTimeout> | undefined;
    const onShow = (event: KeyboardEvent) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      const duration = Platform.OS === 'ios' ? event.duration || 250 : 180;
      syncKeyboardLift(duration);
      // Android can resize the modal window just after the keyboard event.
      resyncTimer = setTimeout(() => syncKeyboardLift(120), 60);
    };
    const onHide = (event: KeyboardEvent) => {
      keyboardTopRef.current = null;
      const duration = Platform.OS === 'ios' ? event.duration || 250 : 160;
      applyKeyboardLift(0, duration);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      if (resyncTimer) {
        clearTimeout(resyncTimer);
      }
    };
  }, [visible, applyKeyboardLift, syncKeyboardLift]);

  const sheetMaxHeight =
    rootHeight > 0
      ? keyboardLift > 0
        ? Math.max(rootHeight - keyboardLift - topInset - 8, 200)
        : rootHeight * 0.92
      : undefined;

  const exerciseNameInputStyle = useMemo(
    () => [styles.input, { color: textColor, borderColor, backgroundColor: inputBackground }],
    [textColor, borderColor, inputBackground],
  );
  const setRowInputStyle = useMemo(
    () => [
      styles.input,
      styles.setInput,
      styles.unitInput,
      { color: textColor, borderColor, backgroundColor: inputBackground },
    ],
    [textColor, borderColor, inputBackground],
  );

  const updateDraft = (recipe: (current: ExerciseDraftRow) => ExerciseDraftRow) => {
    setDraft((current) => recipe(current));
  };

  const submit = () => {
    const parsed = parseWorkoutExerciseFromDraft(draft, newId());
    if (!parsed.ok) {
      if (parsed.title) {
        themedAlert(parsed.title, parsed.message);
      } else {
        themedAlert('Add an exercise', 'Enter the exercise details before adding it to this log.');
      }
      return;
    }
    onAdd(parsed.exercise, addToWorkout);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <RNView
        ref={rootRef}
        collapsable={false}
        onLayout={(event) => {
          setRootHeight(event.nativeEvent.layout.height);
          if (keyboardTopRef.current != null) {
            syncKeyboardLift(0);
          }
        }}
        style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close Create Exercise" />
        <Animated.View style={[styles.sheetWrap, { marginBottom: animatedLift }]}>
          <View
            style={[
              styles.sheet,
              {
                borderColor,
                paddingBottom: keyboardLift > 0 ? 12 : bottomInset + 16,
                maxHeight: sheetMaxHeight,
              },
            ]}>
            <View style={styles.header} lightColor="transparent" darkColor="transparent">
              <Text style={styles.title}>Create Exercise</Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={textColor} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.scrollView}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scroll}
              nestedScrollEnabled>
              <ExerciseDraftFieldsEditor
                draft={draft}
                activeScheme={activeScheme}
                borderColor={borderColor}
                textColor={textColor}
                exerciseNameInputStyle={exerciseNameInputStyle}
                setRowInputStyle={setRowInputStyle}
                onActivityTypeChange={(activityType: ActivityType) =>
                  updateDraft((current) => applyActivityTypeChangeToDraftRow(current, activityType))
                }
                onNameChange={(name) => updateDraft((current) => ({ ...current, name }))}
                onFieldChange={(field: ExerciseDraftField, value: string) =>
                  updateDraft((current) => ({ ...current, [field]: value }))
                }
                onDistanceUnitChange={(unit: CardioDistanceUnit) =>
                  updateDraft((current) => ({ ...current, distanceUnit: unit }))
                }
                onCardioObjectiveChange={(objective: CardioObjective) =>
                  updateDraft((current) => applyCardioObjectiveChangeToDraftRow(current, objective))
                }
                onCardioDurationTrackingChange={(tracking: CardioDurationTracking) =>
                  updateDraft((current) => applyCardioDurationTrackingChangeToDraftRow(current, tracking))
                }
                onCardioDistanceTrackingChange={(tracking: CardioDistanceTracking) =>
                  updateDraft((current) => applyCardioDistanceTrackingChangeToDraftRow(current, tracking))
                }
                onDurationUnitChange={(unit: DurationUnit) =>
                  updateDraft((current) => ({ ...current, durationUnit: unit }))
                }
                onPaceDurationUnitChange={(unit: DurationUnit) =>
                  updateDraft((current) => ({ ...current, paceDurationUnit: unit }))
                }
                onPaceDistanceUnitChange={(unit: CardioDistanceUnit) =>
                  updateDraft((current) => ({ ...current, paceDistanceUnit: unit }))
                }
                onScoreUnitChange={(unit: ScoreUnit) => updateDraft((current) => ({ ...current, scoreUnit: unit }))}
                onWeightUnitChange={(unit: WeightUnit) =>
                  updateDraft((current) => ({ ...current, weightUnit: unit }))
                }
                onRestBetweenSetsEnabledChange={(enabled: boolean) =>
                  updateDraft((current) => ({
                    ...current,
                    restBetweenSetsEnabled: enabled,
                    restDuration: enabled ? current.restDuration : '',
                  }))
                }
                onRestDurationUnitChange={(unit: RestDurationUnit) =>
                  updateDraft((current) => ({ ...current, restDurationUnit: unit }))
                }
              />
              <View style={styles.checkRow} lightColor="transparent" darkColor="transparent">
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: addToWorkout }}
                  accessibilityLabel={ADD_TO_WORKOUT_LABEL}
                  onPress={() => setAddToWorkout((checked) => !checked)}
                  style={styles.checkToggle}>
                  <Ionicons name={addToWorkout ? 'checkbox' : 'square-outline'} size={24} color={tint} />
                  <Text style={styles.checkLabel}>{ADD_TO_WORKOUT_LABEL}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`About ${ADD_TO_WORKOUT_LABEL}`}
                  hitSlop={10}
                  onPress={() => themedAlert(ADD_TO_WORKOUT_LABEL, ADD_TO_WORKOUT_HELP, [{ text: 'OK' }])}
                  style={({ pressed }) => [styles.infoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
                  <Ionicons name="information-circle-outline" size={20} color={tint} />
                </Pressable>
              </View>
            </ScrollView>
            <Pressable
              onPress={submit}
              style={({ pressed }) => [styles.addButton, { backgroundColor: tint, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={[styles.addButtonLabel, { color: Colors[activeScheme].background }]}>Add To Log</Text>
            </Pressable>
          </View>
        </Animated.View>
      </RNView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrap: {
    width: '100%',
    maxHeight: '100%',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    paddingTop: 12,
    overflow: 'hidden',
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  setInput: {
    flexGrow: 1,
    minWidth: 80,
  },
  unitInput: {
    paddingRight: 34,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  checkLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoIconPressable: {
    padding: 2,
  },
  addButton: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
