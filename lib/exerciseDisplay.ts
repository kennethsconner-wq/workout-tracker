import type { ActivityType } from '@/lib/activityTypes';
import { ACTIVITY_TYPE_LABELS } from '@/lib/activityTypes';
import { formatCardioDistanceWithUnit } from '@/lib/cardioDistanceUnits';
import { formatDurationWithUnit } from '@/lib/durationUnits';
import type { LoggedWorkoutExercise, WorkoutExercise } from '@/lib/types';

export function formatPlannedExerciseSummary(
  exercise: Pick<
    WorkoutExercise,
    'activityType' | 'sets' | 'reps' | 'weightKg' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'score'
  >,
): string {
  switch (exercise.activityType) {
    case 'strength':
      return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'} × ${exercise.reps} reps @ ${exercise.weightKg} lb`;
    case 'cardio': {
      const parts: string[] = [];
      const durationLabel = formatDurationWithUnit(exercise.duration, exercise.durationUnit);
      if (durationLabel) {
        parts.push(durationLabel);
      }
      const distanceLabel = formatCardioDistanceWithUnit(exercise.distance, exercise.distanceUnit);
      if (distanceLabel) {
        parts.push(distanceLabel);
      }
      return parts.length > 0 ? parts.join(', ') : 'No plan set';
    }
    case 'sport': {
      const parts: string[] = [];
      const durationLabel = formatDurationWithUnit(exercise.duration, exercise.durationUnit);
      if (durationLabel) {
        parts.push(durationLabel);
      }
      const score = exercise.score.trim();
      if (score.length > 0) {
        parts.push(`Score: ${score}`);
      }
      return parts.length > 0 ? parts.join(', ') : 'No plan set';
    }
    default:
      return 'No plan set';
  }
}

export function formatLoggedExerciseSummary(
  exercise: Pick<
    LoggedWorkoutExercise,
    | 'activityType'
    | 'sets'
    | 'reps'
    | 'weightKg'
    | 'duration'
    | 'durationUnit'
    | 'distance'
    | 'distanceUnit'
    | 'score'
    | 'actualSets'
    | 'actualDuration'
    | 'actualDurationUnit'
    | 'actualDistance'
    | 'actualDistanceUnit'
    | 'actualScore'
  >,
): string {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets
        .map((set, index) => `Set ${index + 1}: ${set.actualReps} reps @ ${set.actualWeightKg} lb`)
        .join(' · ');
    case 'cardio': {
      const parts: string[] = [];
      const durationLabel = formatDurationWithUnit(exercise.actualDuration, exercise.actualDurationUnit);
      if (durationLabel) {
        parts.push(durationLabel);
      }
      const distanceLabel = formatCardioDistanceWithUnit(exercise.actualDistance, exercise.actualDistanceUnit);
      if (distanceLabel) {
        parts.push(distanceLabel);
      }
      return parts.length > 0 ? parts.join(', ') : 'Logged';
    }
    case 'sport': {
      const parts: string[] = [];
      const durationLabel = formatDurationWithUnit(exercise.actualDuration, exercise.actualDurationUnit);
      if (durationLabel) {
        parts.push(durationLabel);
      }
      const score = exercise.actualScore.trim();
      if (score.length > 0) {
        parts.push(`Score: ${score}`);
      }
      return parts.length > 0 ? parts.join(', ') : 'Logged';
    }
    default:
      return 'Logged';
  }
}

export function activityTypeLabel(activityType: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[activityType];
}
