import { Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import {
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { ActivityTypePicker } from '@/components/ActivityTypePicker';
import { CardioDistanceModePicker } from '@/components/CardioDistanceModePicker';
import { CardioDistanceUnitPicker } from '@/components/CardioDistanceUnitPicker';
import { DurationUnitPicker } from '@/components/DurationUnitPicker';
import { ScoreUnitPicker } from '@/components/ScoreUnitPicker';
import { WeightUnitPicker } from '@/components/WeightUnitPicker';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceMode } from '@/lib/cardioDistanceMode';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import { usesIntegerDistanceInput } from '@/lib/cardioDistanceUnits';
import { CARDIO_DURATION_UNITS, SPORT_DURATION_UNITS, STRETCH_DURATION_UNITS, usesIntegerDurationInput, type DurationUnit } from '@/lib/durationUnits';
import type { ScoreUnit } from '@/lib/scoreUnits';
import type { WeightUnit } from '@/lib/weightUnits';
import type { ExerciseDraftRow } from '@/lib/exerciseDraft';
import { confirmEditLinkedExercise } from '@/lib/linkedExerciseEdit';
import { themedAlert } from '@/lib/themedAlert';

export type { ExerciseDraftRow } from '@/lib/exerciseDraft';

type NumericDraftField = 'sets' | 'reps' | 'weight' | 'duration' | 'distance';
type TextDraftField = 'score';
type DraftField = NumericDraftField | TextDraftField;

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
  onUpdateExerciseCardioDistanceMode: (clientId: string, mode: CardioDistanceMode) => void;
  onUpdateExerciseDurationUnit: (clientId: string, unit: DurationUnit) => void;
  onUpdateExerciseScoreUnit: (clientId: string, unit: ScoreUnit) => void;
  onUpdateExerciseWeightUnit: (clientId: string, unit: WeightUnit) => void;
  onRemoveExercise: (clientId: string) => void;
  /** When true (e.g. Edit Workout), show a confirmation before removing an exercise. */
  confirmBeforeRemoveExercise?: boolean;
};

function UnitField({
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType,
  editable,
  setRowInputStyle,
  suffixColor,
  wrapStyle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  suffix: string;
  keyboardType: 'number-pad' | 'decimal-pad' | 'default';
  editable: boolean;
  setRowInputStyle: StyleProp<TextStyle>;
  suffixColor: string;
  wrapStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.unitInputWrap, wrapStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        placeholderTextColor="#a3a3a3"
        editable={editable}
        style={[setRowInputStyle, !editable && styles.lockedField]}
      />
      <Text style={[styles.unitSuffix, { color: suffixColor }]}>{suffix}</Text>
    </View>
  );
}

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
  onUpdateExerciseCardioDistanceMode,
  onUpdateExerciseDurationUnit,
  onUpdateExerciseScoreUnit,
  onUpdateExerciseWeightUnit,
  onRemoveExercise,
  confirmBeforeRemoveExercise = false,
}: Props) {
  const suffixColor = activeScheme === 'dark' ? '#a3a3a3' : '#737373';

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

              <ActivityTypePicker
                value={exercise.activityType}
                onChange={(activityType) => onUpdateExerciseActivityType(exercise.clientId, activityType)}
                disabled={fieldsLocked}
              />

              <TextInput
                value={exercise.name}
                onChangeText={(value) => onUpdateExerciseName(exercise.clientId, value)}
                placeholder="Exercise name"
                placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                editable={!fieldsLocked}
                style={[exerciseNameInputStyle, lockedFieldStyle]}
              />

              {exercise.activityType === 'strength' ? (
                <View style={styles.strengthFieldsColumn}>
                  <View style={styles.setRow}>
                    <UnitField
                      value={exercise.sets}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'sets', value)}
                      placeholder="0"
                      suffix="sets"
                      keyboardType="number-pad"
                      editable={!fieldsLocked}
                      setRowInputStyle={[setRowInputStyle, lockedFieldStyle]}
                      suffixColor={suffixColor}
                    />
                    <UnitField
                      value={exercise.reps}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'reps', value)}
                      placeholder="0"
                      suffix="reps"
                      keyboardType="number-pad"
                      editable={!fieldsLocked}
                      setRowInputStyle={[setRowInputStyle, lockedFieldStyle]}
                      suffixColor={suffixColor}
                    />
                  </View>
                  <View style={styles.strengthWeightWrap}>
                    <TextInput
                      value={exercise.weight}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'weight', value)}
                      placeholder="Weight"
                      keyboardType="decimal-pad"
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      editable={!fieldsLocked}
                      style={[setRowInputStyle, lockedFieldStyle, styles.strengthWeightInput]}
                    />
                    <WeightUnitPicker
                      value={exercise.weightUnit}
                      onChange={(unit) => onUpdateExerciseWeightUnit(exercise.clientId, unit)}
                      disabled={fieldsLocked}
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                  </View>
                </View>
              ) : null}

              {exercise.activityType === 'cardio' ? (
                <View style={styles.cardioFieldsColumn}>
                  <View style={styles.cardioDurationWrap}>
                    <TextInput
                      value={exercise.duration}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'duration', value)}
                      placeholder={exercise.cardioDistanceMode === 'total' ? 'Duration (Optional)' : 'Duration'}
                      keyboardType={usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'}
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      editable={!fieldsLocked}
                      style={[setRowInputStyle, lockedFieldStyle, styles.cardioDurationInput]}
                    />
                    <DurationUnitPicker
                      value={exercise.durationUnit}
                      onChange={(unit) => onUpdateExerciseDurationUnit(exercise.clientId, unit)}
                      units={CARDIO_DURATION_UNITS}
                      disabled={fieldsLocked}
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                    <CardioDistanceModePicker
                      value={exercise.cardioDistanceMode}
                      onChange={(mode) => onUpdateExerciseCardioDistanceMode(exercise.clientId, mode)}
                      disabled={fieldsLocked}
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                    {exercise.cardioDistanceMode === 'per' ? (
                      <CardioDistanceUnitPicker
                        value={exercise.distanceUnit}
                        onChange={(unit) => onUpdateExerciseDistanceUnit(exercise.clientId, unit)}
                        disabled={fieldsLocked}
                        borderColor={borderColor}
                        textColor={textColor}
                      />
                    ) : null}
                  </View>
                  <View style={styles.cardioDistanceWrap}>
                    {exercise.cardioDistanceMode === 'per' ? (
                      <Text style={[styles.cardioForLabel, { color: textColor }]}>For</Text>
                    ) : null}
                    <TextInput
                      value={exercise.distance}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'distance', value)}
                      placeholder={exercise.cardioDistanceMode === 'total' ? 'Distance (Optional)' : 'Distance'}
                      keyboardType={usesIntegerDistanceInput(exercise.distanceUnit) ? 'number-pad' : 'decimal-pad'}
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      editable={!fieldsLocked}
                      style={[setRowInputStyle, lockedFieldStyle, styles.cardioDistanceInput]}
                    />
                    <CardioDistanceUnitPicker
                      value={exercise.distanceUnit}
                      onChange={(unit) => onUpdateExerciseDistanceUnit(exercise.clientId, unit)}
                      disabled={fieldsLocked || exercise.cardioDistanceMode === 'per'}
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                  </View>
                </View>
              ) : null}

              {exercise.activityType === 'sport' ? (
                <View style={styles.cardioFieldsColumn}>
                  <View style={styles.cardioDurationWrap}>
                    <TextInput
                      value={exercise.duration}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'duration', value)}
                      placeholder="Duration (Optional)"
                      keyboardType={usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'}
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      editable={!fieldsLocked}
                      style={[setRowInputStyle, lockedFieldStyle, styles.cardioDurationInput]}
                    />
                    <DurationUnitPicker
                      value={exercise.durationUnit}
                      onChange={(unit) => onUpdateExerciseDurationUnit(exercise.clientId, unit)}
                      units={SPORT_DURATION_UNITS}
                      disabled={fieldsLocked}
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                  </View>
                  <View style={styles.sportScoreRow}>
                    <TextInput
                      value={exercise.score}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'score', value)}
                      placeholder="Score (Optional)"
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      editable={!fieldsLocked}
                      style={[setRowInputStyle, lockedFieldStyle, styles.sportScoreInput]}
                    />
                    <ScoreUnitPicker
                      value={exercise.scoreUnit}
                      onChange={(unit) => onUpdateExerciseScoreUnit(exercise.clientId, unit)}
                      disabled={fieldsLocked}
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                  </View>
                </View>
              ) : null}

              {exercise.activityType === 'stretch' ? (
                <View style={styles.stretchRow}>
                  <UnitField
                    value={exercise.sets}
                    onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'sets', value)}
                    placeholder="0"
                    suffix="sets"
                    keyboardType="number-pad"
                    editable={!fieldsLocked}
                    setRowInputStyle={[setRowInputStyle, lockedFieldStyle]}
                    suffixColor={suffixColor}
                    wrapStyle={styles.stretchSetsWrap}
                  />
                  <View style={styles.stretchDurationWrap}>
                    <TextInput
                      value={exercise.duration}
                      onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'duration', value)}
                      placeholder="Duration"
                      keyboardType={usesIntegerDurationInput(exercise.durationUnit) ? 'number-pad' : 'decimal-pad'}
                      placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                      editable={!fieldsLocked}
                      style={[setRowInputStyle, lockedFieldStyle, styles.stretchDurationInput]}
                    />
                    <DurationUnitPicker
                      value={exercise.durationUnit}
                      onChange={(unit) => onUpdateExerciseDurationUnit(exercise.clientId, unit)}
                      units={STRETCH_DURATION_UNITS}
                      disabled={fieldsLocked}
                      borderColor={borderColor}
                      textColor={textColor}
                    />
                  </View>
                </View>
              ) : null}
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  scoreInputWrap: {
    flex: 1,
    minWidth: 0,
  },
  durationInputWrap: {
    flexGrow: 0,
    flexShrink: 0,
    width: 108,
    minWidth: 108,
    maxWidth: 108,
  },
  stretchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  stretchSetsWrap: {
    flexGrow: 0,
    flexShrink: 0,
    width: 108,
    minWidth: 108,
    maxWidth: 108,
  },
  stretchDurationWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stretchDurationInput: {
    flex: 1,
    minWidth: 0,
  },
  strengthFieldsColumn: {
    gap: 8,
    alignSelf: 'stretch',
  },
  strengthWeightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  strengthWeightInput: {
    flex: 1,
    minWidth: 0,
  },
  cardioFieldsColumn: {
    gap: 8,
    alignSelf: 'stretch',
  },
  cardioDurationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  cardioDurationInput: {
    flex: 1,
    minWidth: 0,
  },
  cardioDistanceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  cardioForLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardioDistanceInput: {
    flex: 1,
    minWidth: 0,
  },
  sportScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  sportScoreInput: {
    flex: 1,
    minWidth: 0,
  },
  unitInputWrap: {
    flexGrow: 1,
    minWidth: 80,
    position: 'relative',
  },
  unitSuffix: {
    position: 'absolute',
    right: 12,
    top: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  lockedField: {
    opacity: 0.62,
  },
});
