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

import { AppState } from 'react-native';



import type { DurationTimerMode } from '@/lib/durationTimer';

import { countdownRemainingSeconds, isCountdownExpired } from '@/lib/durationTimer';

import { cancelCountdownExpiryNotification, countdownNotificationsSupported, initializeCountdownNotifications, isAppForegroundForCountdownNotifications, isSameCountdownLogSession, presentCountdownExpiryNotificationNow, scheduleCountdownExpiryNotification, setCountdownExpiryHandledListener, type CountdownLogSession } from '@/lib/countdownNotifications';

import { showCountdownExpiryInAppAlert } from '@/lib/countdownExpiryInAppAlert';

import { exerciseIdFromCountdownTimerId } from '@/lib/countdownTimerIds';

import { isCountdownTimerVisibleOnScreen } from '@/lib/countdownTimerVisibility';

import type { DurationUnit } from '@/lib/durationUnits';



type RunningTimer = {

  startedAt: number;

  durationUnit: DurationUnit;

  mode: DurationTimerMode;

  targetSeconds: number | null;

  exerciseLabel?: string;

  countdownLogSession?: CountdownLogSession;

  notificationScheduled: boolean;

  returnAlertShown: boolean;

  /** When true, countdown display stays at 0:00 after expiry (no negative overtime). */
  clampCountdownAtZero?: boolean;

};

type PausedTimer = {
  pausedElapsedSeconds: number;
  durationUnit: DurationUnit;
  mode: DurationTimerMode;
  targetSeconds: number | null;
  exerciseLabel?: string;
  countdownLogSession?: CountdownLogSession;
  returnAlertShown: boolean;
  clampCountdownAtZero?: boolean;
};



export type StartDurationTimerOptions = {

  durationUnit: DurationUnit;

  mode?: DurationTimerMode;

  targetSeconds?: number | null;

  exerciseLabel?: string;

  countdownLogSession?: CountdownLogSession;

  notificationScheduled?: boolean;

  clampCountdownAtZero?: boolean;

};



export type DurationTimerSnapshot = {

  mode: DurationTimerMode;

  durationUnit: DurationUnit;

  elapsedSeconds: number;

  remainingSeconds: number | null;

  expired: boolean;

};



type DurationTimerContextValue = {

  /** Bumps while any timer is running so subscribers re-render with fresh elapsed times. */

  tick: number;

  isRunning: (timerId: string) => boolean;

  isPaused: (timerId: string) => boolean;

  getTimerSnapshot: (timerId: string) => DurationTimerSnapshot | null;

  getElapsedSeconds: (timerId: string) => number;

  getDurationUnit: (timerId: string) => DurationUnit | null;

  startTimer: (timerId: string, options: StartDurationTimerOptions) => number | null;

  setTimerNotificationScheduled: (timerId: string, notificationScheduled: boolean) => void;

  cancelTimer: (timerId: string) => void;

  pauseTimer: (timerId: string) => void;

  resumeTimer: (timerId: string) => void;

  finishTimer: (timerId: string) => number;

  hasRunningTimerForLogSession: (session: CountdownLogSession) => boolean;

};



const DurationTimerContext = createContext<DurationTimerContextValue | null>(null);



function readElapsedSeconds(timer: RunningTimer): number {

  return (Date.now() - timer.startedAt) / 1000;

}



function buildTimerSnapshot(timer: RunningTimer): DurationTimerSnapshot {

  const elapsedSeconds = readElapsedSeconds(timer);

  if (timer.mode === 'countdown' && timer.targetSeconds !== null) {

    const rawRemaining = countdownRemainingSeconds(elapsedSeconds, timer.targetSeconds);

    const remainingSeconds = timer.clampCountdownAtZero ? Math.max(0, rawRemaining) : rawRemaining;

    return {

      mode: timer.mode,

      durationUnit: timer.durationUnit,

      elapsedSeconds,

      remainingSeconds,

      expired: isCountdownExpired(elapsedSeconds, timer.targetSeconds),

    };

  }

  return {

    mode: timer.mode,

    durationUnit: timer.durationUnit,

    elapsedSeconds,

    remainingSeconds: null,

    expired: false,

  };

}



function buildPausedSnapshot(timer: PausedTimer): DurationTimerSnapshot {
  const elapsedSeconds = timer.pausedElapsedSeconds;

  if (timer.mode === 'countdown' && timer.targetSeconds !== null) {
    const rawRemaining = countdownRemainingSeconds(elapsedSeconds, timer.targetSeconds);
    const remainingSeconds = timer.clampCountdownAtZero ? Math.max(0, rawRemaining) : rawRemaining;

    return {
      mode: timer.mode,
      durationUnit: timer.durationUnit,
      elapsedSeconds,
      remainingSeconds,
      expired: isCountdownExpired(elapsedSeconds, timer.targetSeconds),
    };
  }

  return {
    mode: timer.mode,
    durationUnit: timer.durationUnit,
    elapsedSeconds,
    remainingSeconds: null,
    expired: false,
  };
}

function handleCountdownTimerExpired(timerId: string, timer: RunningTimer): void {
  void cancelCountdownExpiryNotification(timerId);

  if (isAppForegroundForCountdownNotifications()) {
    if (!isCountdownTimerVisibleOnScreen(timerId)) {
      showCountdownExpiryInAppAlert({
        timerId,
        exerciseName: timer.exerciseLabel ?? 'exercise',
        exerciseId: exerciseIdFromCountdownTimerId(timerId),
        logSession: timer.countdownLogSession,
      });
    }
    return;
  }

  if (countdownNotificationsSupported()) {
    void presentCountdownExpiryNotificationNow({
      timerId,
      exerciseName: timer.exerciseLabel ?? 'exercise',
      logSession: timer.countdownLogSession,
    });
  }
}

export function DurationTimerProvider({ children }: { children: ReactNode }) {

  const [timers, setTimers] = useState<Record<string, RunningTimer>>({});

  const [pausedTimers, setPausedTimers] = useState<Record<string, PausedTimer>>({});

  const timersRef = useRef(timers);

  const pausedTimersRef = useRef(pausedTimers);

  const [tick, setTick] = useState(0);



  useEffect(() => {

    timersRef.current = timers;

  }, [timers]);



  useEffect(() => {

    pausedTimersRef.current = pausedTimers;

  }, [pausedTimers]);



  useEffect(() => {

    initializeCountdownNotifications();

  }, []);



  useEffect(() => {

    const markCountdownExpiryHandled = (timerId: string) => {

      setTimers((previous) => {

        const current = previous[timerId];

        if (!current || current.returnAlertShown) {

          return previous;

        }

        return {

          ...previous,

          [timerId]: { ...current, returnAlertShown: true },

        };

      });

      const timer = timersRef.current[timerId];

      if (timer && !timer.returnAlertShown) {

        timersRef.current[timerId] = { ...timer, returnAlertShown: true };

      }

    };

    setCountdownExpiryHandledListener(markCountdownExpiryHandled);

    return () => setCountdownExpiryHandledListener(null);

  }, []);



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



  useEffect(() => {

    if (!hasRunning) {

      return;

    }



    for (const [timerId, timer] of Object.entries(timersRef.current)) {

      if (timer.mode !== 'countdown' || timer.targetSeconds === null || timer.returnAlertShown) {

        continue;

      }



      const elapsedSeconds = readElapsedSeconds(timer);

      if (!isCountdownExpired(elapsedSeconds, timer.targetSeconds)) {

        continue;

      }



      setTimers((previous) => {

        const current = previous[timerId];

        if (!current || current.returnAlertShown) {

          return previous;

        }

        return {

          ...previous,

          [timerId]: { ...current, returnAlertShown: true },

        };

      });

      timersRef.current[timerId] = {
        ...timer,
        returnAlertShown: true,
      };

      handleCountdownTimerExpired(timerId, timer);
    }
  }, [tick, hasRunning]);

  const isRunning = useCallback((timerId: string) => timerId in timers, [timers]);

  const isPaused = useCallback((timerId: string) => timerId in pausedTimers, [pausedTimers]);

  const hasRunningTimerForLogSession = useCallback(
    (session: CountdownLogSession) => {
      const matchesSession = (timer: { countdownLogSession?: CountdownLogSession }) =>
        timer.countdownLogSession !== undefined && isSameCountdownLogSession(timer.countdownLogSession, session);

      return (
        Object.values(timers).some(matchesSession) || Object.values(pausedTimers).some(matchesSession)
      );
    },
    [timers, pausedTimers],
  );

  const getTimerSnapshot = useCallback(

    (timerId: string) => {

      const timer = timers[timerId];

      if (timer) {

        return buildTimerSnapshot(timer);

      }

      const paused = pausedTimers[timerId];

      if (paused) {

        return buildPausedSnapshot(paused);

      }

      return null;

    },

    [timers, pausedTimers, tick],

  );



  const getElapsedSeconds = useCallback(

    (timerId: string) => {

      const timer = timers[timerId];

      if (!timer) {

        return 0;

      }

      return readElapsedSeconds(timer);

    },

    [timers, tick],

  );



  const getDurationUnit = useCallback(

    (timerId: string) => timers[timerId]?.durationUnit ?? null,

    [timers],

  );



  const startTimer = useCallback((timerId: string, options: StartDurationTimerOptions): number | null => {

    if (timersRef.current[timerId]) {

      return null;

    }

    if (pausedTimersRef.current[timerId]) {

      setPausedTimers((previous) => {

        if (!(timerId in previous)) {

          return previous;

        }

        const next = { ...previous };

        delete next[timerId];

        pausedTimersRef.current = next;

        return next;

      });

    }

    const mode = options.mode ?? 'countup';

    const targetSeconds =

      mode === 'countdown' && options.targetSeconds !== undefined && options.targetSeconds !== null

        ? options.targetSeconds

        : null;

    const startedAt = Date.now();

    const next = {

      ...timersRef.current,

      [timerId]: {

        startedAt,

        durationUnit: options.durationUnit,

        mode,

        targetSeconds,

        exerciseLabel: options.exerciseLabel,

        countdownLogSession: options.countdownLogSession,

        notificationScheduled: options.notificationScheduled ?? false,

        returnAlertShown: false,

        clampCountdownAtZero: options.clampCountdownAtZero ?? false,

      },

    };

    timersRef.current = next;

    setTimers(next);

    return startedAt;

  }, []);



  const setTimerNotificationScheduled = useCallback((timerId: string, notificationScheduled: boolean) => {

    setTimers((previous) => {

      const current = previous[timerId];

      if (!current) {

        return previous;

      }

      const next = {

        ...previous,

        [timerId]: { ...current, notificationScheduled },

      };

      timersRef.current = next;

      return next;

    });

  }, []);



  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        for (const [timerId, timer] of Object.entries(timersRef.current)) {
          if (timer.mode !== 'countdown' || timer.targetSeconds === null) {
            continue;
          }

          void cancelCountdownExpiryNotification(timerId);
          if (timer.notificationScheduled) {
            setTimerNotificationScheduled(timerId, false);
          }

          if (timer.returnAlertShown) {
            continue;
          }

          const elapsedSeconds = readElapsedSeconds(timer);
          if (!isCountdownExpired(elapsedSeconds, timer.targetSeconds)) {
            continue;
          }

          setTimers((previous) => {
            const current = previous[timerId];
            if (!current || current.returnAlertShown) {
              return previous;
            }
            return {
              ...previous,
              [timerId]: { ...current, returnAlertShown: true },
            };
          });

          timersRef.current[timerId] = {
            ...timer,
            returnAlertShown: true,
          };

          handleCountdownTimerExpired(timerId, timer);
        }
        return;
      }

      if (nextState !== 'background' || !countdownNotificationsSupported()) {
        return;
      }

      for (const [timerId, timer] of Object.entries(timersRef.current)) {
        if (timer.mode !== 'countdown' || timer.targetSeconds === null || timer.returnAlertShown) {
          continue;
        }

        const fireAtMs = timer.startedAt + timer.targetSeconds * 1000;
        if (Date.now() >= fireAtMs || timer.notificationScheduled) {
          continue;
        }

        void scheduleCountdownExpiryNotification({
          timerId,
          exerciseName: timer.exerciseLabel ?? 'exercise',
          fireAtMs,
          logSession: timer.countdownLogSession,
        }).then((scheduled) => {
          if (scheduled) {
            setTimerNotificationScheduled(timerId, true);
          }
        });
      }
    });

    return () => subscription.remove();
  }, [setTimerNotificationScheduled]);



  const cancelTimer = useCallback((timerId: string) => {

    const timer = timersRef.current[timerId];

    if (timer?.mode === 'countdown') {

      void cancelCountdownExpiryNotification(timerId);

    }



    setTimers((previous) => {

      if (!(timerId in previous)) {

        return previous;

      }

      const next = { ...previous };

      delete next[timerId];

      timersRef.current = next;

      return next;

    });

    setPausedTimers((previous) => {

      if (!(timerId in previous)) {

        return previous;

      }

      const next = { ...previous };

      delete next[timerId];

      pausedTimersRef.current = next;

      return next;

    });

  }, []);



  const pauseTimer = useCallback((timerId: string) => {

    const timer = timersRef.current[timerId];

    if (!timer) {

      return;

    }

    if (timer.mode === 'countdown') {

      void cancelCountdownExpiryNotification(timerId);

    }

    const pausedTimer: PausedTimer = {

      pausedElapsedSeconds: readElapsedSeconds(timer),

      durationUnit: timer.durationUnit,

      mode: timer.mode,

      targetSeconds: timer.targetSeconds,

      exerciseLabel: timer.exerciseLabel,

      countdownLogSession: timer.countdownLogSession,

      returnAlertShown: timer.returnAlertShown,

      clampCountdownAtZero: timer.clampCountdownAtZero,

    };

    setTimers((previous) => {

      if (!(timerId in previous)) {

        return previous;

      }

      const next = { ...previous };

      delete next[timerId];

      timersRef.current = next;

      return next;

    });

    setPausedTimers((previous) => {

      const next = { ...previous, [timerId]: pausedTimer };

      pausedTimersRef.current = next;

      return next;

    });

  }, []);



  const resumeTimer = useCallback((timerId: string) => {

    const paused = pausedTimersRef.current[timerId];

    if (!paused) {

      return;

    }

    const startedAt = Date.now() - paused.pausedElapsedSeconds * 1000;

    setPausedTimers((previous) => {

      if (!(timerId in previous)) {

        return previous;

      }

      const next = { ...previous };

      delete next[timerId];

      pausedTimersRef.current = next;

      return next;

    });

    setTimers((previous) => {

      const next = {

        ...previous,

        [timerId]: {

          startedAt,

          durationUnit: paused.durationUnit,

          mode: paused.mode,

          targetSeconds: paused.targetSeconds,

          exerciseLabel: paused.exerciseLabel,

          countdownLogSession: paused.countdownLogSession,

          notificationScheduled: false,

          returnAlertShown: paused.returnAlertShown,

          clampCountdownAtZero: paused.clampCountdownAtZero,

        },

      };

      timersRef.current = next;

      return next;

    });

  }, []);



  const finishTimer = useCallback((timerId: string) => {

    const timer = timersRef.current[timerId];

    if (!timer) {

      return 0;

    }

    if (timer.mode === 'countdown') {

      void cancelCountdownExpiryNotification(timerId);

    }

    const elapsed = readElapsedSeconds(timer);

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

      isPaused,

      getTimerSnapshot,

      getElapsedSeconds,

      getDurationUnit,

      startTimer,

      setTimerNotificationScheduled,

      cancelTimer,

      pauseTimer,

      resumeTimer,

      finishTimer,

      hasRunningTimerForLogSession,

    }),

    [tick, isRunning, isPaused, getTimerSnapshot, getElapsedSeconds, getDurationUnit, startTimer, setTimerNotificationScheduled, cancelTimer, pauseTimer, resumeTimer, finishTimer, hasRunningTimerForLogSession],

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


