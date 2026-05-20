import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { WorkoutIconGlyph } from '@/components/WorkoutIconGlyph';
import { themedAlert } from '@/lib/themedAlert';
import { WORKOUT_ICON_OPTIONS, type WorkoutIconId } from '@/lib/workoutIcons';

const WORKOUT_ICON_INFO_MESSAGE =
  'Icon selection is purely aesthetic. It only helps you tell this workout apart from your other workouts.';

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
      <View style={styles.labelRow} lightColor="transparent" darkColor="transparent">
        <Text style={[styles.label, { color: textColor }]}>Icon</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About workout icons"
          hitSlop={10}
          onPress={() => themedAlert('Workout icon', WORKOUT_ICON_INFO_MESSAGE, [{ text: 'OK' }])}
          style={({ pressed }) => [styles.infoIconPressable, { opacity: pressed ? 0.55 : 1 }]}>
          <Ionicons name="information-circle-outline" size={18} color={Colors[activeScheme].tint} />
        </Pressable>
      </View>
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
    marginTop: 10,
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  infoIconPressable: {
    padding: 2,
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
