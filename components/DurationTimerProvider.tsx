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

import { AppState, Vibration } from 'react-native';



import type { DurationTimerMode } from '@/lib/durationTimer';

import { countdownRemainingSeconds, isCountdownExpired } from '@/lib/durationTimer';

import { cancelCountdownExpiryNotification, countdownNotificationsSupported, initializeCountdownNotifications, presentCountdownExpiryNotificationNow, type CountdownLogSession } from '@/lib/countdownNotifications';

import { themedAlert } from '@/lib/themedAlert';

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

};



export type StartDurationTimerOptions = {

  durationUnit: DurationUnit;

  mode?: DurationTimerMode;

  targetSeconds?: number | null;

  exerciseLabel?: string;

  countdownLogSession?: CountdownLogSession;

  notificationScheduled?: boolean;

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

  getTimerSnapshot: (timerId: string) => DurationTimerSnapshot | null;

  getElapsedSeconds: (timerId: string) => number;

  getDurationUnit: (timerId: string) => DurationUnit | null;

  startTimer: (timerId: string, options: StartDurationTimerOptions) => number | null;

  setTimerNotificationScheduled: (timerId: string, notificationScheduled: boolean) => void;

  cancelTimer: (timerId: string) => void;

  finishTimer: (timerId: string) => number;

};



const DurationTimerContext = createContext<DurationTimerContextValue | null>(null);



function readElapsedSeconds(timer: RunningTimer): number {

  return (Date.now() - timer.startedAt) / 1000;

}



function buildTimerSnapshot(timer: RunningTimer): DurationTimerSnapshot {

  const elapsedSeconds = readElapsedSeconds(timer);

  if (timer.mode === 'countdown' && timer.targetSeconds !== null) {

    return {

      mode: timer.mode,

      durationUnit: timer.durationUnit,

      elapsedSeconds,

      remainingSeconds: countdownRemainingSeconds(elapsedSeconds, timer.targetSeconds),

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



function notifyCountdownReturnAlert(exerciseLabel: string | undefined) {

  Vibration.vibrate([0, 350, 150, 350]);

  const label = exerciseLabel?.trim() || 'your exercise';

  themedAlert("Time's up!", `Your planned duration for ${label} has finished.`);

}



export function DurationTimerProvider({ children }: { children: ReactNode }) {

  const [timers, setTimers] = useState<Record<string, RunningTimer>>({});

  const timersRef = useRef(timers);

  const [tick, setTick] = useState(0);



  useEffect(() => {

    timersRef.current = timers;

  }, [timers]);



  useEffect(() => {

    initializeCountdownNotifications();

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



      if (AppState.currentState !== 'active') {

        void cancelCountdownExpiryNotification(timerId);

        void presentCountdownExpiryNotificationNow({

          timerId,

          exerciseName: timer.exerciseLabel ?? 'exercise',

          logSession: timer.countdownLogSession,

        });

      } else if (!timer.notificationScheduled || !countdownNotificationsSupported()) {

        notifyCountdownReturnAlert(timer.exerciseLabel);

      }

    }

  }, [tick, hasRunning]);



  useEffect(() => {

    const subscription = AppState.addEventListener('change', (nextState) => {

      if (nextState !== 'active') {

        return;

      }



      for (const [timerId, timer] of Object.entries(timersRef.current)) {

        if (timer.mode !== 'countdown' || timer.targetSeconds === null || timer.returnAlertShown) {

          continue;

        }

        if (timer.notificationScheduled && countdownNotificationsSupported()) {

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

        notifyCountdownReturnAlert(timer.exerciseLabel);

      }

    });



    return () => subscription.remove();

  }, []);



  const isRunning = useCallback((timerId: string) => timerId in timers, [timers]);



  const getTimerSnapshot = useCallback(

    (timerId: string) => {

      const timer = timers[timerId];

      if (!timer) {

        return null;

      }

      return buildTimerSnapshot(timer);

    },

    [timers, tick],

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

      getTimerSnapshot,

      getElapsedSeconds,

      getDurationUnit,

      startTimer,

      setTimerNotificationScheduled,

      cancelTimer,

      finishTimer,

    }),

    [tick, isRunning, getTimerSnapshot, getElapsedSeconds, getDurationUnit, startTimer, setTimerNotificationScheduled, cancelTimer, finishTimer],

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


