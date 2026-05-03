import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { WorkoutIconGlyph } from '@/components/WorkoutIconGlyph';
import { WORKOUT_ICON_OPTIONS, type WorkoutIconId } from '@/lib/workoutIcons';

type Props = {
  value: WorkoutIconId;
  onChange: (next: WorkoutIconId) => void;
};

export function WorkoutIconPicker({ value, onChange }: Props) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';
  const mutedIcon = activeScheme === 'dark' ? '#a3a3a3' : '#737373';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: textColor }]}>Icon</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.iconScroll}
        contentContainerStyle={styles.iconRowContent}>
        {WORKOUT_ICON_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => onChange(opt.id)}
              style={[
                styles.cell,
                { borderColor },
                selected && { borderColor: Colors[activeScheme].tint },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Workout icon ${opt.id}`}>
              <WorkoutIconGlyph iconId={opt.id} size={26} color={selected ? Colors[activeScheme].tint : mutedIcon} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  iconScroll: {
    width: '100%',
    flexGrow: 0,
  },
  iconRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingRight: 8,
  },
  cell: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
