import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View as RNView } from 'react-native';

import { Text } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  registerThemedAlert,
  type ThemedAlertButton,
  type ThemedAlertOptions,
} from '@/lib/themedAlert';

const DESTRUCTIVE_COLOR = '#ef4444';

type AlertState = ThemedAlertOptions;

export function ThemedAlertProvider({ children }: { children: ReactNode }) {
  const colorScheme = useColorScheme();
  const activeScheme = colorScheme ?? 'dark';
  const palette = Colors[activeScheme];
  const borderColor = activeScheme === 'dark' ? '#404040' : '#d4d4d4';

  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const dismiss = useCallback(() => {
    setAlertState(null);
  }, []);

  const show = useCallback((options: ThemedAlertOptions) => {
    setAlertState(options);
  }, []);

  useEffect(() => {
    registerThemedAlert(show);
    return () => registerThemedAlert(null);
  }, [show]);

  const buttons = useMemo(
    () => alertState?.buttons ?? [{ text: 'OK' }],
    [alertState?.buttons],
  );

  const onButtonPress = (button: ThemedAlertButton) => {
    dismiss();
    button.onPress?.();
  };

  const onRequestClose = () => {
    const cancel = buttons.find((b) => b.style === 'cancel');
    if (cancel) {
      onButtonPress(cancel);
      return;
    }
    dismiss();
  };

  return (
    <>
      {children}
      <Modal
        visible={alertState !== null}
        transparent
        animationType="fade"
        onRequestClose={onRequestClose}
        accessibilityViewIsModal>
        <RNView style={styles.overlay}>
          <RNView
            style={[
              styles.card,
              {
                backgroundColor: palette.background,
                borderColor,
              },
            ]}
            accessibilityRole="alert">
            <Text style={[styles.title, { color: palette.tint }]}>{alertState?.title ?? ''}</Text>
            {alertState?.message ? (
              <Text style={[styles.message, { color: palette.text }]}>{alertState.message}</Text>
            ) : null}
            <RNView
              style={[
                styles.buttons,
                buttons.length > 2 && styles.buttonsStacked,
                buttons.length === 1 && styles.buttonsSingle,
              ]}>
              {buttons.map((button, index) => {
                const style = button.style ?? 'default';
                const isStacked = buttons.length > 2;
                const isSingle = buttons.length === 1;
                const buttonFlex = isSingle || isStacked ? undefined : { flex: 1 };

                let backgroundColor = palette.tint;
                let labelColor = palette.background;
                let buttonBorderColor = palette.tint;

                if (style === 'cancel') {
                  backgroundColor = 'transparent';
                  labelColor = palette.text;
                  buttonBorderColor = borderColor;
                } else if (style === 'destructive') {
                  backgroundColor = DESTRUCTIVE_COLOR;
                  labelColor = '#ffffff';
                  buttonBorderColor = DESTRUCTIVE_COLOR;
                }

                return (
                  <Pressable
                    key={`${button.text}-${index}`}
                    accessibilityRole="button"
                    onPress={() => onButtonPress(button)}
                    style={({ pressed }) => [
                      styles.button,
                      buttonFlex,
                      isStacked && styles.buttonStacked,
                      isSingle && styles.buttonSingle,
                      {
                        backgroundColor,
                        borderColor: buttonBorderColor,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}>
                    <Text style={[styles.buttonLabel, { color: labelColor }]}>{button.text}</Text>
                  </Pressable>
                );
              })}
            </RNView>
          </RNView>
        </RNView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
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
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  buttonsSingle: {
    justifyContent: 'flex-end',
  },
  buttonsStacked: {
    flexDirection: 'column',
  },
  button: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonStacked: {
    width: '100%',
  },
  buttonSingle: {
    minWidth: 88,
    paddingHorizontal: 20,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});
