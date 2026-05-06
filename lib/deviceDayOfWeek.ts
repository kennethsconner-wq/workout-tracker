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

/**
 * Chooses which workout id to select when the list is shown or refreshed.
 * If exactly one workout matches the device's current weekday, that id is used.
 * If several match, the one with the title first alphabetically wins.
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
