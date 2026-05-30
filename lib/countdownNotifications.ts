import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import {
  focusLogWorkoutSession,
  type LogWorkoutSession,
} from '@/lib/logWorkoutNavigation';
import { themedAlert } from '@/lib/themedAlert';

export const COUNTDOWN_EXPIRY_NOTIFICATION_TYPE = 'countdown-expiry';

const ANDROID_CHANNEL_ID = 'countdown-timers';
const EXACT_ALARM_PROMPT_KEY = 'countdown-exact-alarm-prompted@v2';

let initialized = false;
let notificationsModulePromise: Promise<typeof import('expo-notifications') | null> | null = null;

export type CountdownLogSession = Pick<LogWorkoutSession, 'workoutId' | 'loggedWorkoutId' | 'intent'>;

type CountdownNotificationContentInput = {
  timerId: string;
  exerciseName: string;
  logSession?: CountdownLogSession;
};

/** Local scheduled notifications require a development or production build — not Expo Go (SDK 53+). */
export function countdownNotificationsSupported(): boolean {
  if (Platform.OS === 'web') {
    return false;
  }
  return Constants.appOwnership !== 'expo';
}

export function countdownNotificationsUnavailableReason(): string | null {
  if (countdownNotificationsSupported()) {
    return null;
  }
  if (Platform.OS === 'web') {
    return 'Notifications are not available on web.';
  }
  return 'Background countdown alerts need a development build. In Expo Go, use the in-app timer and keep the app open, or install a dev build.';
}

export function countdownNotificationIdentifier(timerId: string): string {
  return `countdown-${timerId}`;
}

async function loadNotificationsModule(): Promise<typeof import('expo-notifications') | null> {
  if (!countdownNotificationsSupported()) {
    return null;
  }
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications').catch(() => null);
  }
  return notificationsModulePromise;
}

/** Warm the notifications module so the first countdown does not wait on a dynamic import. */
export function preloadCountdownNotificationsModule(): void {
  void loadNotificationsModule();
}

function handleCountdownNotificationResponse(data: Record<string, unknown> | undefined): void {
  if (data?.type !== COUNTDOWN_EXPIRY_NOTIFICATION_TYPE) {
    return;
  }
  const workoutId = typeof data.workoutId === 'string' ? data.workoutId : undefined;
  if (!workoutId) {
    return;
  }
  const intent = data.logIntent === 'edit' ? 'edit' : 'new';
  const loggedWorkoutId = typeof data.loggedWorkoutId === 'string' ? data.loggedWorkoutId : undefined;
  const session: LogWorkoutSession =
    intent === 'edit' && loggedWorkoutId
      ? { intent: 'edit', workoutId, loggedWorkoutId }
      : { intent: 'new', workoutId };
  focusLogWorkoutSession(session);
}

export function initializeCountdownNotifications(): void {
  preloadCountdownNotificationsModule();

  if (initialized || !countdownNotificationsSupported()) {
    return;
  }
  initialized = true;

  void (async () => {
    const Notifications = await loadNotificationsModule();
    if (!Notifications) {
      initialized = false;
      return;
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Countdown timers',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
        sound: 'default',
      });
    }

    Notifications.addNotificationResponseReceivedListener((response) => {
      handleCountdownNotificationResponse(response.notification.request.content.data);
    });

    const initialResponse = await Notifications.getLastNotificationResponseAsync();
    if (initialResponse) {
      handleCountdownNotificationResponse(initialResponse.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
  })();
}

export async function ensureCountdownNotificationPermissions(): Promise<boolean> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return (
    requested.granted || requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/** Android 12+ needs the Alarms & reminders permission for sub-minute precise countdown alerts. */
export async function promptForExactAlarmPermissionIfNeeded(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const alreadyPrompted = await AsyncStorage.getItem(EXACT_ALARM_PROMPT_KEY);
  if (alreadyPrompted === '1') {
    return;
  }

  await AsyncStorage.setItem(EXACT_ALARM_PROMPT_KEY, '1');

  themedAlert(
    'Enable precise countdown alerts',
    'On the next screen, allow Alarms & reminders for Workout Tracker so stretch and cardio timers notify you on time. If the app is not listed, reinstall the latest build and try again.',
    [
      {
        text: 'Open settings',
        onPress: () => {
          void openExactAlarmSettings();
        },
      },
      { text: 'Not now', style: 'cancel' },
    ],
  );
}

async function openExactAlarmSettings(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package ?? 'com.kconsoft.workouttracker';
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM', [
      { key: 'android.provider.extra.APP_PACKAGE', value: pkg },
    ]);
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      // Best effort only.
    }
  }
}

function buildCountdownNotificationContent(input: CountdownNotificationContentInput) {
  const trimmedExerciseName = input.exerciseName.trim() || 'your exercise';
  return {
    title: "Time's up!",
    body: `Your planned duration for ${trimmedExerciseName} has finished.`,
    sound: true as const,
    ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    data: {
      type: COUNTDOWN_EXPIRY_NOTIFICATION_TYPE,
      timerId: input.timerId,
      workoutId: input.logSession?.workoutId,
      loggedWorkoutId: input.logSession?.loggedWorkoutId,
      logIntent: input.logSession?.intent,
    },
  };
}

type ScheduleCountdownExpiryNotificationInput = CountdownNotificationContentInput & {
  /** Wall-clock expiry time aligned with the in-app timer startedAt + targetSeconds. */
  fireAtMs: number;
};

export async function scheduleCountdownExpiryNotification(
  input: ScheduleCountdownExpiryNotificationInput,
): Promise<boolean> {
  const secondsUntilFire = Math.ceil((input.fireAtMs - Date.now()) / 1000);
  if (secondsUntilFire <= 0) {
    await presentCountdownExpiryNotificationNow(input);
    return true;
  }

  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return false;
  }

  const permitted = await ensureCountdownNotificationPermissions();
  if (!permitted) {
    return false;
  }

  void promptForExactAlarmPermissionIfNeeded();

  const identifier = countdownNotificationIdentifier(input.timerId);

  await Notifications.cancelScheduledNotificationAsync(identifier);

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: buildCountdownNotificationContent(input),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(input.fireAtMs),
    },
  });

  return true;
}

/** Immediate alert used when the app detects expiry while backgrounded (avoids inexact-alarm delay). */
export async function presentCountdownExpiryNotificationNow(
  input: CountdownNotificationContentInput,
): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return;
  }

  const permitted = await ensureCountdownNotificationPermissions();
  if (!permitted) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: `${countdownNotificationIdentifier(input.timerId)}-now-${Date.now()}`,
    content: buildCountdownNotificationContent(input),
    trigger: null,
  });
}

export async function cancelCountdownExpiryNotification(timerId: string): Promise<void> {
  const Notifications = await loadNotificationsModule();
  if (!Notifications) {
    return;
  }
  await Notifications.cancelScheduledNotificationAsync(countdownNotificationIdentifier(timerId));
}
