import { StyleSheet, View as RNView } from 'react-native';

import { DurationTimerButton } from '@/components/DurationTimerButton';
import { Text } from '@/components/Themed';
import {
  hasRestBetweenSetsConfigured,
  resolveRestBetweenSetsTimerConfig,
  restBetweenSetsTimerId,
  type RestBetweenSetsFields,
} from '@/lib/restBetweenSets';

type Props = {
  activityType: 'strength' | 'stretch';
  exerciseId: string;
  afterSetIndex: number;
  rest: RestBetweenSetsFields;
  activeScheme: 'light' | 'dark';
  borderColor: string;
  textColor: string;
};

export function RestBetweenSetsLogRow({
  activityType,
  exerciseId,
  afterSetIndex,
  rest,
  activeScheme,
  borderColor,
  textColor,
}: Props) {
  if (!hasRestBetweenSetsConfigured(rest)) {
    return null;
  }

  const timerConfig = resolveRestBetweenSetsTimerConfig(rest);

  return (
    <RNView style={[styles.row, { borderColor }]}>
      <RNView style={styles.labelGroup}>
        <Text style={[styles.label, { color: textColor }]}>Rest</Text>
        <DurationTimerButton
          timerId={restBetweenSetsTimerId(activityType, exerciseId, afterSetIndex)}
          durationUnit={rest.restDurationUnit ?? 'seconds'}
          timerMode={timerConfig.timerMode}
          countdownTargetSeconds={timerConfig.countdownTargetSeconds}
          clampCountdownAtZero
          notifyOnExpire={false}
          onComplete={() => {}}
          activeScheme={activeScheme}
          accessibilityLabel={`Start rest timer after set ${afterSetIndex + 1}`}
        />
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 8,
    borderLeftWidth: 2,
    borderRadius: 8,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
