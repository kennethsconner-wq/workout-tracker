import { Ionicons } from '@expo/vector-icons';
import type { ReactElement } from 'react';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import {
  Alert,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { confirmEditLinkedExercise } from '@/lib/linkedExerciseEdit';

export type DraftExerciseRow = {
  clientId: string;
  sourceExerciseId?: string;
  name: string;
  sets: string;
  reps: string;
  weightKg: string;
};

type Props = {
  exercises: DraftExerciseRow[];
  onReorder: (next: DraftExerciseRow[]) => void;
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
  onUpdateExerciseField: (clientId: string, field: 'sets' | 'reps' | 'weightKg', value: string) => void;
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
  onUpdateExerciseField,
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
        const lockedFieldStyle = fieldsLocked ? { opacity: 0.62 } : null;
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
                        Alert.alert(
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
              <TextInput
                value={exercise.name}
                onChangeText={(value) => onUpdateExerciseName(exercise.clientId, value)}
                placeholder="Exercise name"
                placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                editable={!fieldsLocked}
                style={[exerciseNameInputStyle, lockedFieldStyle]}
              />
              <View style={styles.setRow}>
                <View style={styles.unitInputWrap}>
                  <TextInput
                    value={exercise.sets}
                    onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'sets', value)}
                    placeholder="0"
                    keyboardType="number-pad"
                    placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                    editable={!fieldsLocked}
                    style={[setRowInputStyle, lockedFieldStyle]}
                  />
                  <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                    sets
                  </Text>
                </View>
                <View style={styles.unitInputWrap}>
                  <TextInput
                    value={exercise.reps}
                    onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'reps', value)}
                    placeholder="0"
                    keyboardType="number-pad"
                    placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                    editable={!fieldsLocked}
                    style={[setRowInputStyle, lockedFieldStyle]}
                  />
                  <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                    reps
                  </Text>
                </View>
                <View style={styles.unitInputWrap}>
                  <TextInput
                    value={exercise.weightKg}
                    onChangeText={(value) => onUpdateExerciseField(exercise.clientId, 'weightKg', value)}
                    placeholder="Weight"
                    keyboardType="decimal-pad"
                    placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
                    editable={!fieldsLocked}
                    style={[setRowInputStyle, lockedFieldStyle]}
                  />
                  <Text style={[styles.unitSuffix, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                    lb
                  </Text>
                </View>
              </View>
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
});
