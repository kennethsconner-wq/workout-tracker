import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  DURATION_UNIT_ABBREVIATIONS,
  DURATION_UNIT_LABELS,
  SPORT_DURATION_UNITS,
  type DurationUnit,
} from '@/lib/durationUnits';

type Props = {
  value: DurationUnit;
  onChange: (next: DurationUnit) => void;
  /** Defaults to sport/time units (excludes `breaths`; cardio `sets` is a distance unit). */
  units?: readonly DurationUnit[];
  disabled?: boolean;
  borderColor: string;
  textColor: string;
};

export function DurationUnitPicker({
  value,
  onChange,
  units = SPORT_DURATION_UNITS,
  disabled = false,
  borderColor,
  textColor,
}: Props) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const tint = Colors[activeScheme].tint;
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Duration unit: ${DURATION_UNIT_LABELS[value]}. Tap to change.`}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.button,
          { borderColor, backgroundColor: activeScheme === 'dark' ? '#171717' : '#fafafa' },
          disabled && styles.buttonDisabled,
          pressed && !disabled && styles.buttonPressed,
        ]}>
        <Text style={[styles.buttonLabel, { color: textColor }]} numberOfLines={1}>
          {DURATION_UNIT_ABBREVIATIONS[value]}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: activeScheme === 'dark' ? '#171717' : '#fff', borderColor }]}
            onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.sheetTitle, { color: textColor }]}>Duration unit</Text>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {units.map((unit) => {
                const selected = unit === value;
                return (
                  <Pressable
                    key={unit}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      onChange(unit);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      { borderColor },
                      selected && { borderColor: tint, backgroundColor: activeScheme === 'dark' ? 'rgba(35, 213, 213, 0.12)' : 'rgba(57, 170, 170, 0.12)' },
                      pressed && styles.optionPressed,
                    ]}>
                    <Text style={[styles.optionLabel, { color: textColor }]}>{DURATION_UNIT_LABELS[unit]}</Text>
                    <Text style={[styles.optionAbbrev, { color: activeScheme === 'dark' ? '#a3a3a3' : '#737373' }]}>
                      {DURATION_UNIT_ABBREVIATIONS[unit]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} hitSlop={8} style={styles.cancelWrap}>
              <Text style={[styles.cancelLabel, { color: tint }]}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.62,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    maxHeight: '70%',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  list: {
    flexGrow: 0,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionPressed: {
    opacity: 0.75,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionAbbrev: {
    fontSize: 14,
    fontWeight: '600',
  },
  cancelWrap: {
    alignItems: 'center',
    paddingTop: 4,
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
