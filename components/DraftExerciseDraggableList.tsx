import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useState, type ReactElement } from 'react';
import DraggableFlatList, {
  OpacityDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import {
  Keyboard,
  Platform,
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
import type { RestDurationUnit } from '@/lib/restBetweenSets';
import { confirmEditLinkedExercise } from '@/lib/linkedExerciseEdit';
import { themedAlert } from '@/lib/themedAlert';

export type { ExerciseDraftRow } from '@/lib/exerciseDraft';

type DraftField = ExerciseDraftField;

const COMPACT_CARD_MIN_HEIGHT = 72;
const DRAG_ANIMATION_CONFIG = Platform.select({
  android: {
    damping: 24,
    mass: 0.15,
    stiffness: 220,
    overshootClamping: true,
  },
  default: undefined,
});

type RowProps = {
  exercise: ExerciseDraftRow;
  exIndex: number;
  isActive: boolean;
  isDragging: boolean;
  drag: () => void;
  onBeginDrag: (drag: () => void) => void;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  textColor: string;
  exerciseNameInputStyle: StyleProp<TextStyle>;
  setRowInputStyle: StyleProp<TextStyle>;
  fieldsLocked: boolean;
  confirmBeforeRemoveExercise: boolean;
  onUnlockLinked: (clientId: string) => void;
  onUpdateExerciseName: (clientId: string, name: string) => void;
  onUpdateExerciseActivityType: (clientId: string, activityType: ActivityType) => void;
  onUpdateExerciseField: (clientId: string, field: DraftField, value: string) => void;
  onUpdateExerciseDistanceUnit: (clientId: string, unit: CardioDistanceUnit) => void;
  onUpdateExerciseCardioObjective: (clientId: string, objective: CardioObjective) => void;
  onUpdateExerciseCardioDurationTracking: (clientId: string, tracking: CardioDurationTracking) => void;
  onUpdateExerciseCardioDistanceTracking: (clientId: string, tracking: CardioDistanceTracking) => void;
  onUpdateExerciseDurationUnit: (clientId: string, unit: DurationUnit) => void;
  onUpdateExercisePaceDurationUnit: (clientId: string, unit: DurationUnit) => void;
  onUpdateExercisePaceDistanceUnit: (clientId: string, unit: CardioDistanceUnit) => void;
  onUpdateExerciseScoreUnit: (clientId: string, unit: ScoreUnit) => void;
  onUpdateExerciseWeightUnit: (clientId: string, unit: WeightUnit) => void;
  onUpdateExerciseRestBetweenSetsEnabled: (clientId: string, enabled: boolean) => void;
  onUpdateExerciseRestDurationUnit: (clientId: string, unit: RestDurationUnit) => void;
  onRemoveExercise: (clientId: string) => void;
};

const DraftExerciseListRow = memo(function DraftExerciseListRow({
  exercise,
  exIndex,
  isActive,
  isDragging,
  drag,
  onBeginDrag,
  activeScheme,
  borderColor,
  textColor,
  exerciseNameInputStyle,
  setRowInputStyle,
  fieldsLocked,
  confirmBeforeRemoveExercise,
  onUnlockLinked,
  onUpdateExerciseName,
  onUpdateExerciseActivityType,
  onUpdateExerciseField,
  onUpdateExerciseDistanceUnit,
  onUpdateExerciseCardioObjective,
  onUpdateExerciseCardioDurationTracking,
  onUpdateExerciseCardioDistanceTracking,
  onUpdateExerciseDurationUnit,
  onUpdateExercisePaceDurationUnit,
  onUpdateExercisePaceDistanceUnit,
  onUpdateExerciseScoreUnit,
  onUpdateExerciseWeightUnit,
  onUpdateExerciseRestBetweenSetsEnabled,
  onUpdateExerciseRestDurationUnit,
  onRemoveExercise,
}: RowProps) {
  const lockedFieldStyle = fieldsLocked ? styles.lockedField : null;
  const showCompactBody = isDragging;
  const displayName = exercise.name.trim() || 'Untitled exercise';

  return (
    <OpacityDecorator activeOpacity={0.92}>
      <View
        style={[
          styles.card,
          showCompactBody && styles.compactCard,
          { borderColor, opacity: isActive ? 0.95 : 1 },
        ]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeading, styles.cardHeaderTitle]} numberOfLines={1}>
            Exercise {exIndex + 1}
          </Text>
          {!isDragging ? (
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
          ) : null}
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
              onLongPress={() => onBeginDrag(drag)}
              hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}
              style={({ pressed }) => [
                styles.dragHandlePressable,
                pressed && styles.dragHandlePressablePressed,
              ]}>
              <Ionicons name="reorder-three-outline" size={26} color={Colors[activeScheme].tint} />
            </Pressable>
          </View>
        </View>

        {showCompactBody ? (
          <Text style={[styles.compactSubtitle, { color: textColor }]} numberOfLines={2}>
            {displayName}
          </Text>
        ) : (
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
            onPaceDurationUnitChange={(unit) => onUpdateExercisePaceDurationUnit(exercise.clientId, unit)}
            onPaceDistanceUnitChange={(unit) => onUpdateExercisePaceDistanceUnit(exercise.clientId, unit)}
            onScoreUnitChange={(unit) => onUpdateExerciseScoreUnit(exercise.clientId, unit)}
            onWeightUnitChange={(unit) => onUpdateExerciseWeightUnit(exercise.clientId, unit)}
            onRestBetweenSetsEnabledChange={(enabled) =>
              onUpdateExerciseRestBetweenSetsEnabled(exercise.clientId, enabled)
            }
            onRestDurationUnitChange={(unit) => onUpdateExerciseRestDurationUnit(exercise.clientId, unit)}
          />
        )}
      </View>
    </OpacityDecorator>
  );
});

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
  onUpdateExercisePaceDurationUnit: (clientId: string, unit: DurationUnit) => void;
  onUpdateExercisePaceDistanceUnit: (clientId: string, unit: CardioDistanceUnit) => void;
  onUpdateExerciseScoreUnit: (clientId: string, unit: ScoreUnit) => void;
  onUpdateExerciseWeightUnit: (clientId: string, unit: WeightUnit) => void;
  onUpdateExerciseRestBetweenSetsEnabled: (clientId: string, enabled: boolean) => void;
  onUpdateExerciseRestDurationUnit: (clientId: string, unit: RestDurationUnit) => void;
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
  onUpdateExercisePaceDurationUnit,
  onUpdateExercisePaceDistanceUnit,
  onUpdateExerciseScoreUnit,
  onUpdateExerciseWeightUnit,
  onUpdateExerciseRestBetweenSetsEnabled,
  onUpdateExerciseRestDurationUnit,
  onRemoveExercise,
  confirmBeforeRemoveExercise = false,
}: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const beginDrag = useCallback((drag: () => void) => {
    Keyboard.dismiss();
    setIsDragging(true);
    const startDrag = () => drag();
    if (Platform.OS === 'android') {
      // Let compact row layout settle before measuring drag targets on Android.
      requestAnimationFrame(() => {
        requestAnimationFrame(startDrag);
      });
      return;
    }
    requestAnimationFrame(startDrag);
  }, []);

  const handleDragEnd = useCallback(
    ({ data }: { data: ExerciseDraftRow[] }) => {
      onReorder(data);
      setIsDragging(false);
    },
    [onReorder],
  );

  const keyExtractor = useCallback((item: ExerciseDraftRow) => item.clientId, []);

  const renderPlaceholder = useCallback(
    ({ item, index }: { item: ExerciseDraftRow; index: number }) => (
      <View style={[styles.card, styles.compactCard, styles.dragPlaceholder, { borderColor }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardHeading, styles.cardHeaderTitle]} numberOfLines={1}>
            Exercise {index + 1}
          </Text>
        </View>
        <Text style={[styles.compactSubtitle, styles.dragPlaceholderSubtitle]} numberOfLines={1}>
          {item.name.trim() || 'Untitled exercise'}
        </Text>
      </View>
    ),
    [borderColor],
  );

  const renderItem = useCallback(
    ({ item: exercise, drag, isActive, getIndex }: RenderItemParams<ExerciseDraftRow>) => {
      const exIndex = getIndex() ?? 0;
      const fieldsLocked =
        exercise.sourceExerciseId !== undefined && !unlockedExerciseClientIds.has(exercise.clientId);

      return (
        <DraftExerciseListRow
          exercise={exercise}
          exIndex={exIndex}
          isActive={isActive}
          isDragging={isDragging}
          drag={drag}
          onBeginDrag={beginDrag}
          activeScheme={activeScheme}
          borderColor={borderColor}
          textColor={textColor}
          exerciseNameInputStyle={exerciseNameInputStyle}
          setRowInputStyle={setRowInputStyle}
          fieldsLocked={fieldsLocked}
          confirmBeforeRemoveExercise={confirmBeforeRemoveExercise}
          onUnlockLinked={onUnlockLinked}
          onUpdateExerciseName={onUpdateExerciseName}
          onUpdateExerciseActivityType={onUpdateExerciseActivityType}
          onUpdateExerciseField={onUpdateExerciseField}
          onUpdateExerciseDistanceUnit={onUpdateExerciseDistanceUnit}
          onUpdateExerciseCardioObjective={onUpdateExerciseCardioObjective}
          onUpdateExerciseCardioDurationTracking={onUpdateExerciseCardioDurationTracking}
          onUpdateExerciseCardioDistanceTracking={onUpdateExerciseCardioDistanceTracking}
          onUpdateExerciseDurationUnit={onUpdateExerciseDurationUnit}
          onUpdateExercisePaceDurationUnit={onUpdateExercisePaceDurationUnit}
          onUpdateExercisePaceDistanceUnit={onUpdateExercisePaceDistanceUnit}
          onUpdateExerciseScoreUnit={onUpdateExerciseScoreUnit}
          onUpdateExerciseWeightUnit={onUpdateExerciseWeightUnit}
          onUpdateExerciseRestBetweenSetsEnabled={onUpdateExerciseRestBetweenSetsEnabled}
          onUpdateExerciseRestDurationUnit={onUpdateExerciseRestDurationUnit}
          onRemoveExercise={onRemoveExercise}
        />
      );
    },
    [
      activeScheme,
      beginDrag,
      borderColor,
      confirmBeforeRemoveExercise,
      exerciseNameInputStyle,
      isDragging,
      onRemoveExercise,
      onUnlockLinked,
      onUpdateExerciseActivityType,
      onUpdateExerciseCardioDistanceTracking,
      onUpdateExerciseCardioDurationTracking,
      onUpdateExerciseCardioObjective,
      onUpdateExerciseDistanceUnit,
      onUpdateExerciseDurationUnit,
      onUpdateExerciseField,
      onUpdateExerciseName,
      onUpdateExercisePaceDistanceUnit,
      onUpdateExercisePaceDurationUnit,
      onUpdateExerciseRestBetweenSetsEnabled,
      onUpdateExerciseRestDurationUnit,
      onUpdateExerciseScoreUnit,
      onUpdateExerciseWeightUnit,
      setRowInputStyle,
      textColor,
      unlockedExerciseClientIds,
    ],
  );

  return (
    <DraggableFlatList
      containerStyle={styles.listContainer}
      style={styles.listContainer}
      data={exercises}
      extraData={isDragging}
      keyExtractor={keyExtractor}
      onDragEnd={handleDragEnd}
      activationDistance={12}
      animationConfig={DRAG_ANIMATION_CONFIG}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
      renderPlaceholder={renderPlaceholder}
      windowSize={Platform.OS === 'android' ? 5 : 7}
      maxToRenderPerBatch={Platform.OS === 'android' ? 4 : 8}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  compactCard: {
    minHeight: COMPACT_CARD_MIN_HEIGHT,
    gap: 6,
  },
  dragPlaceholder: {
    opacity: 0.35,
  },
  dragPlaceholderSubtitle: {
    opacity: 0.8,
  },
  compactSubtitle: {
    fontSize: 14,
    lineHeight: 20,
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
