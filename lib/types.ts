import type { WorkoutIconId } from '@/lib/workoutIcons';

export type LoggedWorkoutSet = {
  reps: number;
  weightKg: number;
};

export type LoggedWorkoutExercise = {
  id: string;
  name: string;
  sets: LoggedWorkoutSet[];
};

export type LoggedWorkout = {
  id: string;
  createdAt: string;
  title: string;
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

export type Workout = {
  id: string;
  createdAt: string;
  title: string;
  dayOfWeek: DayOfWeek;
  iconId: WorkoutIconId;
  exercises: WorkoutExercise[];
};

export type { WorkoutIconId } from '@/lib/workoutIcons';
