import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, type ActivityType } from '@/lib/activityTypes';

type Props = {
  value: ActivityType;
  onChange: (next: ActivityType) => void;
  disabled?: boolean;
};

export function ActivityTypePicker({ value, onChange, disabled = false }: Props) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';

  return (
    <View style={styles.wrap} lightColor="transparent" darkColor="transparent">
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}>
        {ACTIVITY_TYPES.map((type) => {
          const selected = value === type;
          return (
            <Pressable
              key={type}
              disabled={disabled}
              onPress={() => onChange(type)}
              style={[
                styles.chip,
                { borderColor },
                selected && { borderColor: Colors[activeScheme].tint, backgroundColor: Colors[activeScheme].tint },
                disabled && styles.chipDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`${ACTIVITY_TYPE_LABELS[type]}${selected ? ', selected' : ''}`}>
              <Text style={[styles.chipLabel, { color: selected ? Colors.dark.background : textColor }]}>
                {ACTIVITY_TYPE_LABELS[type]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipDisabled: {
    opacity: 0.62,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
