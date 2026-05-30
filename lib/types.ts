import type { WorkoutIconId } from '@/lib/workoutIcons';
import type { ActivityType } from '@/lib/activityTypes';
import type { CardioDistanceUnit } from '@/lib/cardioDistanceUnits';
import type {
  CardioDistanceTracking,
  CardioDurationTracking,
  CardioObjective,
  LegacyCardioDistanceMode,
} from '@/lib/cardioPlan';
import type { DurationUnit } from '@/lib/durationUnits';
import type { ScoreUnit } from '@/lib/scoreUnits';
import type { WeightUnit } from '@/lib/weightUnits';

export type StretchSet = {
  duration: number;
  durationUnit: DurationUnit;
};

export type LoggedStretchActualSet = {
  actualDuration: number;
  actualDurationUnit: DurationUnit;
};

export type LoggedCardioPerActualSet = {
  actualDuration: number;
  actualDurationUnit: DurationUnit;
  actualDistance: number;
  actualDistanceUnit: CardioDistanceUnit;
};

export type LoggedWorkoutExercise = {
  id: string;
  workoutExerciseId: string;
  activityType: ActivityType;
  name: string;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: WeightUnit;
  duration: number;
  durationUnit: DurationUnit;
  distance: number;
  distanceUnit: CardioDistanceUnit;
  /** Cardio only: primary plan objective. */
  cardioObjective?: CardioObjective;
  /** Cardio + distance objective: how duration is tracked. */
  cardioDurationTracking?: CardioDurationTracking;
  /** Cardio + duration objective: how distance is tracked. */
  cardioDistanceTracking?: CardioDistanceTracking;
  /** Cardio pace: duration amount (e.g. 4.5 seconds). */
  cardioPaceDuration?: number;
  cardioPaceDurationUnit?: DurationUnit;
  /** Cardio pace: distance amount (e.g. 100 yards). */
  cardioPaceDistance?: number;
  cardioPaceDistanceUnit?: CardioDistanceUnit;
  /** @deprecated Migrated to cardioObjective + tracking fields. */
  cardioDistanceMode?: LegacyCardioDistanceMode;
  score: string;
  scoreUnit: ScoreUnit;
  actualSets: LoggedActualSet[];
  actualDuration: number;
  actualDurationUnit: DurationUnit;
  actualDistance: number;
  actualDistanceUnit: CardioDistanceUnit;
  actualScore: string;
  actualScoreUnit: ScoreUnit;
  actualWeightUnit: WeightUnit;
  actualStretchSets: LoggedStretchActualSet[];
  /** Per-segment values for cardio per-unit logging (duration or distance per segment). */
  actualCardioPerSets: LoggedCardioPerActualSet[];
  /** Per-set planned durations for stretch activities (snapshot at log time). */
  stretchSets?: StretchSet[];
  /** @deprecated Legacy stretch logs used actualSetCount + actualDuration. */
  actualSetCount?: number;
};

export type LoggedActualSet = {
  actualReps: number;
  actualWeight: number;
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
  weight: number;
  weightUnit: WeightUnit;
  duration: number;
  durationUnit: DurationUnit;
  distance: number;
  distanceUnit: CardioDistanceUnit;
  /** Cardio only: primary plan objective. */
  cardioObjective?: CardioObjective;
  /** Cardio + distance objective: how duration is tracked. */
  cardioDurationTracking?: CardioDurationTracking;
  /** Cardio + duration objective: how distance is tracked. */
  cardioDistanceTracking?: CardioDistanceTracking;
  /** Cardio pace: duration amount (e.g. 4.5 seconds). */
  cardioPaceDuration?: number;
  cardioPaceDurationUnit?: DurationUnit;
  /** Cardio pace: distance amount (e.g. 100 yards). */
  cardioPaceDistance?: number;
  cardioPaceDistanceUnit?: CardioDistanceUnit;
  /** @deprecated Migrated to cardioObjective + tracking fields. */
  cardioDistanceMode?: LegacyCardioDistanceMode;
  score: string;
  scoreUnit: ScoreUnit;
  /** Per-set planned durations for stretch activities. */
  stretchSets?: StretchSet[];
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
