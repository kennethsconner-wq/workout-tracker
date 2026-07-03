import type { DayOfWeek, Workout } from '@/lib/types';

/** Calendar week order for sorting (Sunday → Saturday), aligned with `Date#getDay()`. */
const CALENDAR_WEEK_SUNDAY_FIRST: readonly DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** `Date#getDay()`: 0 = Sunday … 6 = Saturday — aligned with `DayOfWeek` labels. */
const JS_GET_DAY_TO_DAY_OF_WEEK = CALENDAR_WEEK_SUNDAY_FIRST;

function dayOfWeekSortIndex(day: DayOfWeek): number {
  return CALENDAR_WEEK_SUNDAY_FIRST.indexOf(day);
}

/** Stable copy sorted by weekday (Sunday–Saturday), then title (case-insensitive). */
export function sortWorkoutsForDropdown(workouts: Workout[]): Workout[] {
  return [...workouts].sort((a, b) => {
    const aFirstDay = a.daysOfWeek[0] ?? 'Monday';
    const bFirstDay = b.daysOfWeek[0] ?? 'Monday';
    const byDay = dayOfWeekSortIndex(aFirstDay) - dayOfWeekSortIndex(bFirstDay);
    if (byDay !== 0) {
      return byDay;
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

export function getDeviceDayOfWeek(date: Date = new Date()): DayOfWeek {
  return JS_GET_DAY_TO_DAY_OF_WEEK[date.getDay()];
}

export type WorkoutDueTone = 'due_today' | 'upcoming' | 'completed_today';

export type WorkoutDueIndicator = {
  tone: WorkoutDueTone;
  label: string;
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isLoggedOnOrAfterDay(lastLoggedAt: string | null, dayStart: Date): boolean {
  if (!lastLoggedAt) {
    return false;
  }
  return startOfLocalDay(new Date(lastLoggedAt)).getTime() >= dayStart.getTime();
}

function findScheduledDayFrom(
  daysOfWeek: DayOfWeek[],
  anchor: Date,
  direction: 'past' | 'future',
  includeAnchor: boolean,
): { day: DayOfWeek; date: Date } | null {
  const startOffset = includeAnchor ? 0 : 1;
  for (let offset = startOffset; offset < 7; offset += 1) {
    const candidate = new Date(anchor);
    candidate.setDate(candidate.getDate() + (direction === 'past' ? -offset : offset));
    const day = getDeviceDayOfWeek(candidate);
    if (daysOfWeek.includes(day)) {
      return { day, date: startOfLocalDay(candidate) };
    }
  }
  return null;
}

function formatUpcomingDue(dueDate: Date, today: Date, day: DayOfWeek): WorkoutDueIndicator {
  const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntil === 1) {
    return { tone: 'upcoming', label: 'Due tomorrow' };
  }
  if (daysUntil <= 6) {
    return { tone: 'upcoming', label: `Due ${day}` };
  }
  return { tone: 'upcoming', label: `Due in ${daysUntil} days` };
}

/**
 * Derives a human-readable due status from a workout's schedule and last log time.
 * Compares calendar days in the device's local timezone.
 */
export function getWorkoutDueIndicator(
  daysOfWeek: DayOfWeek[],
  lastLoggedAt: string | null,
  now: Date = new Date(),
): WorkoutDueIndicator | null {
  if (daysOfWeek.length === 0) {
    return null;
  }

  const today = startOfLocalDay(now);
  const todayDay = getDeviceDayOfWeek(now);
  const loggedToday = isLoggedOnOrAfterDay(lastLoggedAt, today);

  if (loggedToday) {
    return { tone: 'completed_today', label: 'Logged today' };
  }

  if (daysOfWeek.includes(todayDay)) {
    return { tone: 'due_today', label: 'Due today' };
  }

  const upcoming = findScheduledDayFrom(daysOfWeek, now, 'future', false);
  if (upcoming) {
    return formatUpcomingDue(upcoming.date, today, upcoming.day);
  }

  return null;
}

/**
 * Chooses which workout id to select when the list is shown or refreshed.
 * If exactly one workout matches the device's current weekday, that id is used.
 * If several match today, picks one deterministically for the UI (sort order only — identity is always by id).
 * If none match, the previous selection is kept when it still exists; otherwise the first workout.
 */
export function pickWorkoutIdForDeviceCalendarDay(
  workouts: Workout[],
  previousSelectedId: string | null,
): string | null {
  if (workouts.length === 0) {
    return null;
  }

  const today = getDeviceDayOfWeek();
  const matches = workouts.filter((w) => w.daysOfWeek.includes(today));

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length > 1) {
    return sortWorkoutsForDropdown(matches)[0].id;
  }

  if (previousSelectedId && workouts.some((w) => w.id === previousSelectedId)) {
    return previousSelectedId;
  }

  return workouts[0].id;
}
