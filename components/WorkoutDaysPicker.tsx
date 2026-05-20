import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { DAYS_OF_WEEK, DAY_OF_WEEK_ABBREVIATIONS, type DayOfWeek } from '@/lib/types';

type Props = {
  value: DayOfWeek[];
  onChange: (next: DayOfWeek[]) => void;
};

export function WorkoutDaysPicker({ value, onChange }: Props) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'light';
  const textColor = Colors[activeScheme].text;
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';

  const toggleDay = (day: DayOfWeek) => {
    if (value.includes(day)) {
      onChange(value.filter((selectedDay) => selectedDay !== day));
      return;
    }
    onChange([...value, day]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: textColor }]}>Days of the Week</Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.daysScroll}
        contentContainerStyle={styles.daysRowContent}>
        {DAYS_OF_WEEK.map((day) => {
          const selected = value.includes(day);
          return (
            <Pressable
              key={day}
              onPress={() => toggleDay(day)}
              style={[
                styles.cell,
                { borderColor },
                selected && { borderColor: Colors[activeScheme].tint, backgroundColor: Colors[activeScheme].tint },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${day} ${selected ? 'selected' : 'not selected'}`}>
              <Text
                style={[
                  styles.dayLabel,
                  { color: selected ? Colors.dark.background : textColor },
                ]}>
                {DAY_OF_WEEK_ABBREVIATIONS[day]}
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
    marginTop: 10,
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  daysScroll: {
    width: '100%',
    flexGrow: 0,
  },
  daysRowContent: {
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
  dayLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
