import { Dimensions } from 'react-native';

const visibilityByTimerId = new Map<string, boolean>();
const recheckListeners = new Set<() => void>();

export function isRectVisibleInWindow(x: number, y: number, width: number, height: number): boolean {
  if (width <= 0 || height <= 0) {
    return false;
  }
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
  return x + width > 0 && x < windowWidth && y + height > 0 && y < windowHeight;
}

export function setCountdownTimerVisibleOnScreen(timerId: string, visible: boolean): void {
  visibilityByTimerId.set(timerId, visible);
}

export function clearCountdownTimerVisibility(timerId: string): void {
  visibilityByTimerId.delete(timerId);
}

/** True only when a mounted timer button recently reported itself on screen. */
export function isCountdownTimerVisibleOnScreen(timerId: string): boolean {
  return visibilityByTimerId.get(timerId) === true;
}

export function notifyCountdownTimerVisibilityRecheck(): void {
  for (const listener of recheckListeners) {
    listener();
  }
}

export function subscribeCountdownTimerVisibilityRecheck(listener: () => void): () => void {
  recheckListeners.add(listener);
  return () => {
    recheckListeners.delete(listener);
  };
}
