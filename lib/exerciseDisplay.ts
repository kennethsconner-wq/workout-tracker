import type { ActivityType } from '@/lib/activityTypes';
import { ACTIVITY_TYPE_LABELS } from '@/lib/activityTypes';
import type { LoggedWorkoutExercise, WorkoutExercise } from '@/lib/types';

function formatDistanceMiles(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatPlannedExerciseSummary(
  exercise: Pick<WorkoutExercise, 'activityType' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score'>,
): string {
  switch (exercise.activityType) {
    case 'strength':
      return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'} × ${exercise.reps} reps @ ${exercise.weightKg} lb`;
    case 'cardio': {
      const parts: string[] = [];
      if (exercise.durationMinutes > 0) {
        parts.push(`${exercise.durationMinutes} min`);
      }
      if (exercise.distanceMiles > 0) {
        parts.push(`${formatDistanceMiles(exercise.distanceMiles)} mi`);
      }
      return parts.length > 0 ? parts.join(', ') : 'No plan set';
    }
    case 'sport': {
      const parts: string[] = [];
      if (exercise.durationMinutes > 0) {
        parts.push(`${exercise.durationMinutes} min`);
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
    'activityType' | 'sets' | 'reps' | 'weightKg' | 'durationMinutes' | 'distanceMiles' | 'score' | 'actualSets' | 'actualDurationMinutes' | 'actualDistanceMiles' | 'actualScore'
  >,
): string {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets
        .map((set, index) => `Set ${index + 1}: ${set.actualReps} reps @ ${set.actualWeightKg} lb`)
        .join(' · ');
    case 'cardio': {
      const parts: string[] = [];
      if (exercise.actualDurationMinutes > 0) {
        parts.push(`${exercise.actualDurationMinutes} min`);
      }
      if (exercise.actualDistanceMiles > 0) {
        parts.push(`${formatDistanceMiles(exercise.actualDistanceMiles)} mi`);
      }
      return parts.length > 0 ? parts.join(', ') : 'Logged';
    }
    case 'sport': {
      const parts: string[] = [];
      if (exercise.actualDurationMinutes > 0) {
        parts.push(`${exercise.actualDurationMinutes} min`);
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
