import type { WorkoutIconId } from '@/lib/workoutIcons';

export type LoggedWorkoutExercise = {
  id: string;
  workoutExerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
  actualSets: LoggedActualSet[];
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
  name: string;
  sets: number;
  reps: number;
  weightKg: number;
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
