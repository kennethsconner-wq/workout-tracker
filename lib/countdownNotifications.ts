import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, Linking, Platform } from 'react-native';

import {
  focusLogWorkoutExercise,
  type LogWorkoutSession,
} from '@/lib/logWorkoutNavigation';
import { exerciseIdFromCountdownTimerId } from '@/lib/countdownTimerIds';
import { themedAlert } from '@/lib/themedAlert';

export const COUNTDOWN_EXPIRY_NOTIFICATION_TYPE = 'countdown-expiry';

const ANDROID_CHANNEL_ID = 'countdown-timers-v2';
const EXACT_ALARM_PROMPT_KEY = 'countdown-exact-alarm-prompted@v2';

let initialized = false;
let exactAlarmPromptShownThisSession = false;
let androidChannelReadyPromise: Promise<void> | null = null;
let countdownExpiryHandledListener: ((timerId: string) => void) | null = null;

type NotificationsModule = typeof Notifications;

export type CountdownLogSession = Pick<LogWorkoutSession, 'workoutId' | 'loggedWorkoutId' | 'intent'>;

export function isSameCountdownLogSession(a: CountdownLogSession, b: CountdownLogSession): boolean {
  return (
    a.workoutId === b.workoutId &&
    a.intent === b.intent &&
    (a.loggedWorkoutId ?? '') === (b.loggedWorkoutId ?? '')
  );
}

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

function loadNotificationsModule(): NotificationsModule | null {
  if (!countdownNotificationsSupported()) {
    return null;
  }
  return Notifications;
}

/** Warm the notifications module so the first countdown does not wait on lazy loading. */
export function preloadCountdownNotificationsModule(): void {
  loadNotificationsModule();
}

async function isCountdownNotificationScheduled(timerId: string): Promise<boolean> {
  const NotificationsModule = loadNotificationsModule();
  if (!NotificationsModule) {
    return false;
  }

  const identifier = countdownNotificationIdentifier(timerId);
  const scheduled = await NotificationsModule.getAllScheduledNotificationsAsync();
  return scheduled.some((request) => request.identifier === identifier);
}

function isCountdownExpiryNotificationData(data: Record<string, unknown> | undefined): boolean {
  return data?.type === COUNTDOWN_EXPIRY_NOTIFICATION_TYPE;
}

/** When true, use in-app timer alerts instead of scheduling/showing system notifications. */
export function isAppForegroundForCountdownNotifications(): boolean {
  // Treat `inactive` (e.g. iOS app switcher / Control Center) as foreground; only `background` is truly backgrounded.
  return AppState.currentState !== 'background';
}

function notifyCountdownExpiryHandled(data: Record<string, unknown> | undefined): void {
  if (data?.type !== COUNTDOWN_EXPIRY_NOTIFICATION_TYPE) {
    return;
  }
  const timerId = typeof data.timerId === 'string' ? data.timerId : undefined;
  if (timerId) {
    countdownExpiryHandledListener?.(timerId);
  }
}

/** Called by DurationTimerProvider so duplicate expiry alerts are suppressed after a scheduled notification fires. */
export function setCountdownExpiryHandledListener(listener: ((timerId: string) => void) | null): void {
  countdownExpiryHandledListener = listener;
}

function handleCountdownNotificationResponse(data: Record<string, unknown> | undefined): void {
  notifyCountdownExpiryHandled(data);
  if (data?.type !== COUNTDOWN_EXPIRY_NOTIFICATION_TYPE) {
    return;
  }
  const workoutId = typeof data.workoutId === 'string' ? data.workoutId : undefined;
  if (!workoutId) {
    return;
  }
  const intent = data.logIntent === 'edit' ? 'edit' : 'new';
  const loggedWorkoutId = typeof data.loggedWorkoutId === 'string' ? data.loggedWorkoutId : undefined;
  const exerciseIdFromData = typeof data.exerciseId === 'string' ? data.exerciseId : null;
  const timerId = typeof data.timerId === 'string' ? data.timerId : '';
  const exerciseId = exerciseIdFromData ?? exerciseIdFromCountdownTimerId(timerId);
  const session: LogWorkoutSession =
    intent === 'edit' && loggedWorkoutId
      ? { intent: 'edit', workoutId, loggedWorkoutId }
      : { intent: 'new', workoutId };
  focusLogWorkoutExercise(session, exerciseId);
}

async function ensureAndroidNotificationChannel(
  NotificationsModule: NotificationsModule,
): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  if (!androidChannelReadyPromise) {
    androidChannelReadyPromise = NotificationsModule.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Countdown timers',
      importance: NotificationsModule.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 150, 250],
      sound: 'default',
      enableVibrate: true,
      showBadge: false,
    }).then(() => undefined);
  }

  await androidChannelReadyPromise;
}

export function initializeCountdownNotifications(): void {
  preloadCountdownNotificationsModule();

  if (initialized || !countdownNotificationsSupported()) {
    return;
  }
  initialized = true;

  void (async () => {
    const NotificationsModule = loadNotificationsModule();
    if (!NotificationsModule) {
      initialized = false;
      return;
    }

    NotificationsModule.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        if (isCountdownExpiryNotificationData(data) && isAppForegroundForCountdownNotifications()) {
          return {
            shouldPlaySound: false,
            shouldSetBadge: false,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }

        return {
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        };
      },
    });

    if (Platform.OS === 'android') {
      await ensureAndroidNotificationChannel(NotificationsModule);
    }

    NotificationsModule.addNotificationResponseReceivedListener((response) => {
      handleCountdownNotificationResponse(response.notification.request.content.data);
    });

    NotificationsModule.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, unknown> | undefined;
      // Foreground expiry is handled by DurationTimerProvider (in-app banner). Marking handled
      // here would suppress that banner while the notification handler hides the system alert.
      if (isCountdownExpiryNotificationData(data) && isAppForegroundForCountdownNotifications()) {
        return;
      }
      notifyCountdownExpiryHandled(data);
    });

    const initialResponse = await NotificationsModule.getLastNotificationResponseAsync();
    if (initialResponse) {
      handleCountdownNotificationResponse(initialResponse.notification.request.content.data);
      NotificationsModule.clearLastNotificationResponse();
    }
  })();
}

export async function ensureCountdownNotificationPermissions(): Promise<boolean> {
  const NotificationsModule = loadNotificationsModule();
  if (!NotificationsModule) {
    return false;
  }

  const current = await NotificationsModule.getPermissionsAsync();
  if (current.granted || current.ios?.status === NotificationsModule.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await NotificationsModule.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  return (
    requested.granted || requested.ios?.status === NotificationsModule.IosAuthorizationStatus.PROVISIONAL
  );
}

/** Android 12+ needs the Alarms & reminders permission for precise countdown alerts. */
export async function promptForExactAlarmPermissionIfNeeded(options?: { force?: boolean }): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 31) {
    return;
  }

  const dismissedPermanently = await AsyncStorage.getItem(EXACT_ALARM_PROMPT_KEY);
  if (dismissedPermanently === '1' && !options?.force) {
    return;
  }
  if (exactAlarmPromptShownThisSession && !options?.force) {
    return;
  }

  exactAlarmPromptShownThisSession = true;

  themedAlert(
    'Enable background timer alerts',
    'For countdown timers to notify you when the app is in the background, allow Alarms & reminders for Axios Workouts on the next screen.',
    [
      {
        text: 'Alarms & reminders',
        onPress: () => {
          void openExactAlarmSettings();
        },
      },
      {
        text: 'App settings',
        onPress: () => {
          void openAppSettings();
        },
      },
      {
        text: 'Not now',
        style: 'cancel',
        onPress: () => {
          void AsyncStorage.setItem(EXACT_ALARM_PROMPT_KEY, '1');
        },
      },
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
    await openAppSettings();
  }
}

async function openAppSettings(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package ?? 'com.kconsoft.workouttracker';
  try {
    await Linking.sendIntent('android.settings.APPLICATION_DETAILS_SETTINGS', [{ key: 'package', value: pkg }]);
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
  const exerciseId = exerciseIdFromCountdownTimerId(input.timerId);
  return {
    title: "Time's up!",
    body: `Your planned duration for ${trimmedExerciseName} has finished.`,
    sound: true as const,
    ...(Platform.OS === 'android'
      ? {
          channelId: ANDROID_CHANNEL_ID,
          priority: 'max' as const,
        }
      : {}),
    data: {
      type: COUNTDOWN_EXPIRY_NOTIFICATION_TYPE,
      timerId: input.timerId,
      exerciseId,
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

async function scheduleCountdownExpiryNotificationInternal(
  input: ScheduleCountdownExpiryNotificationInput,
  options?: { skipExactAlarmPrompt?: boolean },
): Promise<boolean> {
  const NotificationsModule = loadNotificationsModule();
  if (!NotificationsModule) {
    return false;
  }

  const permitted = await ensureCountdownNotificationPermissions();
  if (!permitted) {
    return false;
  }

  if (Platform.OS === 'android') {
    await ensureAndroidNotificationChannel(NotificationsModule);
    if (!options?.skipExactAlarmPrompt) {
      await promptForExactAlarmPermissionIfNeeded();
    }
  }

  const identifier = countdownNotificationIdentifier(input.timerId);

  await NotificationsModule.cancelScheduledNotificationAsync(identifier);

  await NotificationsModule.scheduleNotificationAsync({
    identifier,
    content: buildCountdownNotificationContent(input),
    trigger: {
      type: NotificationsModule.SchedulableTriggerInputTypes.DATE,
      date: new Date(input.fireAtMs),
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });

  return isCountdownNotificationScheduled(input.timerId);
}

export async function scheduleCountdownExpiryNotification(
  input: ScheduleCountdownExpiryNotificationInput,
): Promise<boolean> {
  const secondsUntilFire = Math.ceil((input.fireAtMs - Date.now()) / 1000);
  if (secondsUntilFire <= 0) {
    if (!isAppForegroundForCountdownNotifications()) {
      await presentCountdownExpiryNotificationNow(input);
    }
    return true;
  }

  try {
    const scheduled = await scheduleCountdownExpiryNotificationInternal(input);
    if (scheduled) {
      return true;
    }

    if (Platform.OS === 'android') {
      await promptForExactAlarmPermissionIfNeeded({ force: true });
      return scheduleCountdownExpiryNotificationInternal(input, { skipExactAlarmPrompt: true });
    }

    return false;
  } catch {
    if (Platform.OS === 'android') {
      await promptForExactAlarmPermissionIfNeeded({ force: true });
    }
    return false;
  }
}

/** Immediate alert used when the app detects expiry while backgrounded (avoids inexact-alarm delay). */
export async function presentCountdownExpiryNotificationNow(
  input: CountdownNotificationContentInput,
): Promise<void> {
  if (isAppForegroundForCountdownNotifications()) {
    return;
  }

  const NotificationsModule = loadNotificationsModule();
  if (!NotificationsModule) {
    return;
  }

  const permitted = await ensureCountdownNotificationPermissions();
  if (!permitted) {
    return;
  }

  if (Platform.OS === 'android') {
    await ensureAndroidNotificationChannel(NotificationsModule);
  }

  await NotificationsModule.scheduleNotificationAsync({
    identifier: `${countdownNotificationIdentifier(input.timerId)}-now-${Date.now()}`,
    content: buildCountdownNotificationContent(input),
    trigger: null,
  });
}

export async function cancelCountdownExpiryNotification(timerId: string): Promise<void> {
  const NotificationsModule = loadNotificationsModule();
  if (!NotificationsModule) {
    return;
  }
  await NotificationsModule.cancelScheduledNotificationAsync(countdownNotificationIdentifier(timerId));
}
