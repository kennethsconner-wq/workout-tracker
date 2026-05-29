import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { DurationUnit } from '@/lib/durationUnits';

type RunningTimer = {
  startedAt: number;
  durationUnit: DurationUnit;
};

type DurationTimerContextValue = {
  /** Bumps while any timer is running so subscribers re-render with fresh elapsed times. */
  tick: number;
  isRunning: (timerId: string) => boolean;
  getElapsedSeconds: (timerId: string) => number;
  getDurationUnit: (timerId: string) => DurationUnit | null;
  startTimer: (timerId: string, durationUnit: DurationUnit) => void;
  cancelTimer: (timerId: string) => void;
  finishTimer: (timerId: string) => number;
};

const DurationTimerContext = createContext<DurationTimerContextValue | null>(null);

export function DurationTimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<Record<string, RunningTimer>>({});
  const timersRef = useRef(timers);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  const hasRunning = Object.keys(timers).length > 0;

  useEffect(() => {
    if (!hasRunning) {
      return;
    }
    const intervalId = setInterval(() => {
      setTick((previous) => previous + 1);
    }, 100);
    return () => clearInterval(intervalId);
  }, [hasRunning]);

  const isRunning = useCallback((timerId: string) => timerId in timers, [timers]);

  const getElapsedSeconds = useCallback(
    (timerId: string) => {
      const timer = timers[timerId];
      if (!timer) {
        return 0;
      }
      return (Date.now() - timer.startedAt) / 1000;
    },
    [timers, tick],
  );

  const getDurationUnit = useCallback(
    (timerId: string) => timers[timerId]?.durationUnit ?? null,
    [timers],
  );

  const startTimer = useCallback((timerId: string, durationUnit: DurationUnit) => {
    setTimers((previous) => {
      if (previous[timerId]) {
        return previous;
      }
      const next = {
        ...previous,
        [timerId]: { startedAt: Date.now(), durationUnit },
      };
      timersRef.current = next;
      return next;
    });
  }, []);

  const cancelTimer = useCallback((timerId: string) => {
    setTimers((previous) => {
      if (!(timerId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[timerId];
      timersRef.current = next;
      return next;
    });
  }, []);

  const finishTimer = useCallback((timerId: string) => {
    const timer = timersRef.current[timerId];
    if (!timer) {
      return 0;
    }
    const elapsed = (Date.now() - timer.startedAt) / 1000;
    setTimers((previous) => {
      if (!(timerId in previous)) {
        return previous;
      }
      const next = { ...previous };
      delete next[timerId];
      timersRef.current = next;
      return next;
    });
    return elapsed;
  }, []);

  const value = useMemo(
    () => ({
      tick,
      isRunning,
      getElapsedSeconds,
      getDurationUnit,
      startTimer,
      cancelTimer,
      finishTimer,
    }),
    [tick, isRunning, getElapsedSeconds, getDurationUnit, startTimer, cancelTimer, finishTimer],
  );

  return <DurationTimerContext.Provider value={value}>{children}</DurationTimerContext.Provider>;
}

export function useDurationTimer() {
  const context = useContext(DurationTimerContext);
  if (!context) {
    throw new Error('useDurationTimer must be used within DurationTimerProvider');
  }
  return context;
}
