export type ThemedAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export type ThemedAlertButton = {
  text: string;
  style?: ThemedAlertButtonStyle;
  onPress?: () => void;
};

export type ThemedAlertOptions = {
  title: string;
  message?: string;
  buttons?: ThemedAlertButton[];
};

type ShowThemedAlert = (options: ThemedAlertOptions) => void;

let showThemedAlertImpl: ShowThemedAlert | null = null;

export function registerThemedAlert(show: ShowThemedAlert | null): void {
  showThemedAlertImpl = show;
}

function present(options: ThemedAlertOptions): void {
  if (!showThemedAlertImpl) {
    if (__DEV__) {
      console.warn('[themedAlert] ThemedAlertProvider is not mounted.');
    }
    return;
  }
  showThemedAlertImpl(options);
}

/** Drop-in replacement for `Alert.alert` with app-themed styling. */
export function themedAlert(
  title: string,
  messageOrButtons?: string | ThemedAlertButton[],
  buttons?: ThemedAlertButton[],
): void {
  let message: string | undefined;
  let resolvedButtons: ThemedAlertButton[] | undefined;

  if (Array.isArray(messageOrButtons)) {
    resolvedButtons = messageOrButtons;
  } else {
    message = messageOrButtons;
    resolvedButtons = buttons;
  }

  present({
    title,
    message,
    buttons: resolvedButtons ?? [{ text: 'OK' }],
  });
}
