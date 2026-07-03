import { Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import type { WorkoutSaveCelebration } from '@/lib/workoutSaveCelebration';

type Props = {
  celebration: WorkoutSaveCelebration;
  activeScheme: 'light' | 'dark';
  onDismiss: () => void;
};

export function WorkoutSaveCelebrationOverlay({ celebration, activeScheme, onDismiss }: Props) {
  const palette = Colors[activeScheme];
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';

  return (
    <RNView style={styles.overlay} pointerEvents="box-none">
      <RNView
        style={[
          styles.card,
          {
            backgroundColor: palette.background,
            borderColor,
          },
        ]}
        accessibilityRole="alert">
        <Text style={[styles.title, { color: palette.tint }]}>{celebration.title}</Text>
        <Text style={[styles.message, { color: palette.text }]}>{celebration.message}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: palette.tint,
              borderColor: palette.tint,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Text style={[styles.buttonLabel, { color: palette.background }]}>OK</Text>
        </Pressable>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 30,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.9,
  },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
    alignSelf: 'flex-end',
    minWidth: 88,
    marginTop: 4,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
