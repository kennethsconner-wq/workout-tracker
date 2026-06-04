import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View as RNView } from 'react-native';

import { DurationUnitPicker } from '@/components/DurationUnitPicker';
import { NumericTextInput } from '@/components/NumericTextInput';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { REST_DURATION_UNITS, type RestDurationUnit } from '@/lib/restBetweenSets';
import type { StyleProp, TextStyle } from 'react-native';

type Props = {
  enabled: boolean;
  restDuration: string;
  restDurationUnit: RestDurationUnit;
  disabled?: boolean;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  textColor: string;
  setRowInputStyle: StyleProp<TextStyle>;
  lockedFieldStyle?: StyleProp<TextStyle>;
  onEnabledChange: (enabled: boolean) => void;
  onRestDurationChange: (value: string) => void;
  onRestDurationUnitChange: (unit: RestDurationUnit) => void;
};

export function RestBetweenSetsFieldsEditor({
  enabled,
  restDuration,
  restDurationUnit,
  disabled = false,
  activeScheme,
  borderColor,
  textColor,
  setRowInputStyle,
  lockedFieldStyle,
  onEnabledChange,
  onRestDurationChange,
  onRestDurationUnitChange,
}: Props) {
  const tint = Colors[activeScheme].tint;

  return (
    <View style={styles.column}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel="Rest between sets"
        accessibilityState={{ checked: enabled }}
        disabled={disabled}
        onPress={() => onEnabledChange(!enabled)}
        style={({ pressed }) => [
          styles.checkboxRow,
          lockedFieldStyle,
          pressed && !disabled && styles.pressed,
        ]}
        hitSlop={6}>
        <Ionicons
          name={enabled ? 'checkbox' : 'square-outline'}
          size={22}
          color={disabled ? '#737373' : tint}
        />
        <Text style={[styles.checkboxLabel, { color: textColor }]}>Rest between sets</Text>
      </Pressable>
      {enabled ? (
        <RNView style={styles.durationRow}>
          <NumericTextInput
            value={restDuration}
            onChangeText={onRestDurationChange}
            placeholder="Rest duration"
            placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
            editable={!disabled}
            style={[setRowInputStyle, styles.durationInput]}
          />
          <DurationUnitPicker
            value={restDurationUnit}
            onChange={(unit) => onRestDurationUnitChange(unit as RestDurationUnit)}
            units={REST_DURATION_UNITS}
            disabled={disabled}
            borderColor={borderColor}
            textColor={textColor}
          />
        </RNView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    gap: 8,
    alignSelf: 'stretch',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  durationInput: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.65,
  },
});
