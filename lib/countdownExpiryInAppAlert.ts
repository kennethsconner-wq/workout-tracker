import type { CountdownLogSession } from '@/lib/countdownNotifications';

export type CountdownExpiryInAppAlert = {
  timerId: string;
  exerciseName: string;
  exerciseId: string | null;
  logSession?: CountdownLogSession;
};

type CountdownExpiryInAppAlertListener = ((alert: CountdownExpiryInAppAlert) => void) | null;

let showListener: CountdownExpiryInAppAlertListener = null;
let dismissListener: (() => void) | null = null;

export function registerCountdownExpiryInAppAlertHandlers(handlers: {
  show: (alert: CountdownExpiryInAppAlert) => void;
  dismiss: () => void;
} | null): void {
  showListener = handlers?.show ?? null;
  dismissListener = handlers?.dismiss ?? null;
}

export function showCountdownExpiryInAppAlert(alert: CountdownExpiryInAppAlert): void {
  showListener?.(alert);
}

export function dismissCountdownExpiryInAppAlert(): void {
  dismissListener?.();
}
