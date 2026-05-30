import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { DurationTimerButton } from '@/components/DurationTimerButton';
import { DurationUnitPicker } from '@/components/DurationUnitPicker';
import { NumericTextInput } from '@/components/NumericTextInput';
import { View } from '@/components/Themed';
import { CARDIO_DURATION_UNITS, type DurationUnit } from '@/lib/durationUnits';
import type { DurationTimerMode } from '@/lib/durationTimer';
import type { CountdownLogSession } from '@/lib/countdownNotifications';

type Props = {
  timerId: string;
  value: string;
  onChangeText: (value: string) => void;
  durationUnit: DurationUnit;
  timerMode?: DurationTimerMode;
  countdownTargetSeconds?: number | null;
  countdownExerciseLabel?: string;
  countdownLogSession?: CountdownLogSession;
  placeholder?: string;
  inputStyle: StyleProp<TextStyle>;
  rowStyle?: StyleProp<ViewStyle>;
  wrapStyle?: StyleProp<ViewStyle>;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  textColor: string;
  inputBackground: string;
  timerAccessibilityLabel?: string;
  units?: readonly DurationUnit[];
};

export function CardioDurationLogField({
  timerId,
  value,
  onChangeText,
  durationUnit,
  timerMode = 'countup',
  countdownTargetSeconds = null,
  countdownExerciseLabel,
  countdownLogSession,
  placeholder = 'Duration',
  inputStyle,
  rowStyle,
  wrapStyle,
  activeScheme,
  borderColor,
  textColor,
  inputBackground,
  timerAccessibilityLabel,
  units = CARDIO_DURATION_UNITS,
}: Props) {
  return (
    <View style={[styles.row, rowStyle]}>
      <View style={[styles.durationWrap, wrapStyle]}>
        <NumericTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={activeScheme === 'dark' ? '#737373' : '#a3a3a3'}
          style={[inputStyle, styles.durationInput, { color: textColor, borderColor, backgroundColor: inputBackground }]}
        />
        <DurationUnitPicker
          value={durationUnit}
          onChange={() => {}}
          units={units}
          disabled
          borderColor={borderColor}
          textColor={textColor}
        />
      </View>
      <DurationTimerButton
        timerId={timerId}
        durationUnit={durationUnit}
        timerMode={timerMode}
        countdownTargetSeconds={countdownTargetSeconds}
        countdownExerciseLabel={countdownExerciseLabel}
        countdownLogSession={countdownLogSession}
        onComplete={onChangeText}
        activeScheme={activeScheme}
        accessibilityLabel={timerAccessibilityLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationInput: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
});
