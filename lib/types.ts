import type { WorkoutIconId } from '@/lib/workoutIcons';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import type { DurationUnit } from '@/lib/durationUnits';

export type LoggedWorkoutExercise = {
  id: string;
  workoutExerciseId: string;
  activityType: ActivityType;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  duration: number;
  durationUnit: DurationUnit;
  distance: number;
  distanceUnit: CardioDistanceUnit;
  score: string;
  actualSets: LoggedActualSet[];
  actualDuration: number;
  actualDurationUnit: DurationUnit;
  actualDistance: number;
  actualDistanceUnit: CardioDistanceUnit;
  actualScore: string;
};

export type LoggedActualSet = {
  actualReps: number;
  actualWeightKg: number;
};

export type LoggedWorkout = {
  id: string;
  workoutId: string;
  createdAt: string;
  title: string;
  daysOfWeek: DayOfWeek[];
  iconId: WorkoutIconId;
  exercises: LoggedWorkoutExercise[];
};

export type WorkoutExercise = {
  id: string;
  activityType: ActivityType;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  duration: number;
  durationUnit: DurationUnit;
  distance: number;
  distanceUnit: CardioDistanceUnit;
  score: string;
};

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];
export const DAY_OF_WEEK_ABBREVIATIONS: Record<DayOfWeek, string> = {
  Sunday: 'SU',
  Monday: 'M',
  Tuesday: 'TU',
  Wednesday: 'W',
  Thursday: 'TH',
  Friday: 'F',
  Saturday: 'SA',
};

export type Workout = {
  id: string;
  createdAt: string;
  title: string;
  daysOfWeek: DayOfWeek[];
  iconId: WorkoutIconId;
  exercises: WorkoutExercise[];
};

export type { WorkoutIconId } from '@/lib/workoutIcons';
