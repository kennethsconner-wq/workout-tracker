import { Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ExerciseDraftFieldsEditor, type ExerciseDraftField } from '@/components/ExerciseDraftFieldsEditor';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import type { CardioDistanceTracking, CardioDurationTracking, CardioObjective } from '@/lib/cardioPlan';
import type { DurationUnit } from '@/lib/durationUnits';
import type { ScoreUnit } from '@/lib/scoreUnits';
import type { WeightUnit } from '@/lib/weightUnits';
import type { ExerciseDraftRow } from '@/lib/exerciseDraft';
import { confirmEditLinkedExercise } from '@/lib/linkedExerciseEdit';
import { themedAlert } from '@/lib/themedAlert';

export type { ExerciseDraftRow } from '@/lib/exerciseDraft';

type DraftField = ExerciseDraftField;

type Props = {
  exercises: ExerciseDraftRow[];
  onReorder: (next: ExerciseDraftRow[]) => void;
  listHeader: ReactElement;
  listFooter: ReactElement;
  contentContainerStyle: StyleProp<ViewStyle>;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  textColor: string;
  exerciseNameInputStyle: StyleProp<TextStyle>;
  setRowInputStyle: StyleProp<TextStyle>;
  unlockedExerciseClientIds: Set<string>;
  onUnlockLinked: (clientId: string) => void;
  onUpdateExerciseName: (clientId: string, name: string) => void;
  onUpdateExerciseActivityType: (clientId: string, activityType: ActivityType) => void;
  onUpdateExerciseField: (clientId: string, field: DraftField, value: string) => void;
  onUpdateExerciseDistanceUnit: (clientId: string, unit: CardioDistanceUnit) => void;
  onUpdateExerciseCardioObjective: (clientId: string, objective: CardioObjective) => void;
  onUpdateExerciseCardioDurationTracking: (clientId: string, tracking: CardioDurationTracking) => void;
  onUpdateExerciseCardioDistanceTracking: (clientId: string, tracking: CardioDistanceTracking) => void;
  onUpdateExerciseDurationUnit: (clientId: string, unit: DurationUnit) => void;
  onUpdateExerciseScoreUnit: (clientId: string, unit: ScoreUnit) => void;
  onUpdateExerciseWeightUnit: (clientId: string, unit: WeightUnit) => void;
  onRemoveExercise: (clientId: string) => void;
  /** When true (e.g. Edit Workout), show a confirmation before removing an exercise. */
  confirmBeforeRemoveExercise?: boolean;
};

export function DraftExerciseDraggableList({
  exercises,
  onReorder,
  listHeader,
  listFooter,
  contentContainerStyle,
  activeScheme,
  borderColor,
  textColor,
  exerciseNameInputStyle,
  setRowInputStyle,
  unlockedExerciseClientIds,
  onUnlockLinked,
  onUpdateExerciseName,
  onUpdateExerciseActivityType,
  onUpdateExerciseField,
  onUpdateExerciseDistanceUnit,
  onUpdateExerciseCardioObjective,
  onUpdateExerciseCardioDurationTracking,
  onUpdateExerciseCardioDistanceTracking,
  onUpdateExerciseDurationUnit,
  onUpdateExerciseScoreUnit,
  onUpdateExerciseWeightUnit,
  onRemoveExercise,
  confirmBeforeRemoveExercise = false,
}: Props) {
  return (
    <DraggableFlatList
      containerStyle={{ flex: 1 }}
      style={{ flex: 1 }}
      data={exercises}
      keyExtractor={(item) => item.clientId}
      onDragBegin={() => {
        Keyboard.dismiss();
      }}
      onDragEnd={({ data }) => onReorder(data)}
      activationDistance={12}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      renderItem={({ item: exercise, drag, isActive, getIndex }) => {
        const exIndex = getIndex() ?? 0;
        const fieldsLocked =
          exercise.sourceExerciseId !== undefined && !unlockedExerciseClientIds.has(exercise.clientId);
        const lockedFieldStyle = fieldsLocked ? styles.lockedField : null;

        return (
          <ScaleDecorator>
            <View style={[styles.card, { borderColor, opacity: isActive ? 0.95 : 1 }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardHeading, styles.cardHeaderTitle]} numberOfLines={1}>
                  Exercise {exIndex + 1}
                </Text>
                <View style={styles.cardHeaderActions}>
                  {exercise.sourceExerciseId !== undefined && fieldsLocked ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit linked exercise"
                      onPress={() =>
                        confirmEditLinkedExercise(() => {
                          onUnlockLinked(exercise.clientId);
                        })
                      }
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.exerciseHeaderIconPressable,
                        pressed && styles.exerciseHeaderIconPressed,
                      ]}>
                      <Ionicons name="pencil-outline" size={22} color={Colors[activeScheme].tint} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Remove exercise"
                    onPress={() => {
                      if (confirmBeforeRemoveExercise) {
                        const label = exercise.name.trim() || 'this exercise';
                        themedAlert(
                          'Remove exercise?',
                          `Remove "${label}" from this workout?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Remove',
                              style: 'destructive',
                              onPress: () => onRemoveExercise(exercise.clientId),
                            },
                          ],
                        );
                        return;
                      }
                      onRemoveExercise(exercise.clientId);
                    }}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.exerciseHeaderIconPressable,
                      pressed && styles.exerciseHeaderIconPressed,
                    ]}>
                    <Ionicons name="close-outline" size={26} color="#ef4444" />
                  </Pressable>
                </View>
                <View
                  style={styles.dragHandleOverlay}
                  pointerEvents="box-none"
                  lightColor="transparent"
                  darkColor="transparent">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Drag to reorder exercise"
                    accessibilityHint="Press and hold, then drag to change exercise order"
                    delayLongPress={350}
                    onLongPress={drag}
                    hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
                    style={({ pressed }) => [
                      styles.dragHandlePressable,
                      pressed && styles.dragHandlePressablePressed,
                    ]}>
                    <Ionicons name="reorder-three-outline" size={26} color={Colors[activeScheme].tint} />
                  </Pressable>
                </View>
              </View>

              <ExerciseDraftFieldsEditor
                draft={exercise}
                disabled={fieldsLocked}
                activeScheme={activeScheme}
                borderColor={borderColor}
                textColor={textColor}
                exerciseNameInputStyle={exerciseNameInputStyle}
                setRowInputStyle={setRowInputStyle}
                lockedFieldStyle={lockedFieldStyle}
                onActivityTypeChange={(activityType) => onUpdateExerciseActivityType(exercise.clientId, activityType)}
                onNameChange={(name) => onUpdateExerciseName(exercise.clientId, name)}
                onFieldChange={(field, value) => onUpdateExerciseField(exercise.clientId, field, value)}
                onDistanceUnitChange={(unit) => onUpdateExerciseDistanceUnit(exercise.clientId, unit)}
                onCardioObjectiveChange={(objective) => onUpdateExerciseCardioObjective(exercise.clientId, objective)}
                onCardioDurationTrackingChange={(tracking) =>
                  onUpdateExerciseCardioDurationTracking(exercise.clientId, tracking)
                }
                onCardioDistanceTrackingChange={(tracking) =>
                  onUpdateExerciseCardioDistanceTracking(exercise.clientId, tracking)
                }
                onDurationUnitChange={(unit) => onUpdateExerciseDurationUnit(exercise.clientId, unit)}
                onScoreUnitChange={(unit) => onUpdateExerciseScoreUnit(exercise.clientId, unit)}
                onWeightUnitChange={(unit) => onUpdateExerciseWeightUnit(exercise.clientId, unit)}
              />
            </View>
          </ScaleDecorator>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardHeaderTitle: {
    flex: 1,
    minWidth: 0,
    maxWidth: '44%',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    zIndex: 2,
  },
  exerciseHeaderIconPressable: {
    padding: 4,
  },
  exerciseHeaderIconPressed: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    position: 'relative',
  },
  dragHandleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 1,
  },
  dragHandlePressable: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  dragHandlePressablePressed: {
    opacity: 0.65,
  },
  lockedField: {
    opacity: 0.62,
  },
});
