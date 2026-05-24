import type { ActivityType } from '@/lib/activityTypes';

import { ACTIVITY_TYPE_LABELS } from '@/lib/activityTypes';

import { formatCardioDistanceWithUnit, formatCardioPerDistanceUnit } from '@/lib/cardioDistanceUnits';
import { cardioPerRowLabel } from '@/lib/cardioPerLog';

import { normalizeCardioDistanceMode } from '@/lib/cardioDistanceMode';

import { formatDurationWithUnit } from '@/lib/durationUnits';

import { formatScoreWithUnit } from '@/lib/scoreUnits';

import { formatWeightWithUnit } from '@/lib/weightUnits';

import type { LoggedWorkoutExercise, WorkoutExercise } from '@/lib/types';



export function formatPlannedExerciseSummary(

  exercise: Pick<

    WorkoutExercise,

    'activityType' | 'sets' | 'reps' | 'weight' | 'weightUnit' | 'duration' | 'durationUnit' | 'distance' | 'distanceUnit' | 'cardioDistanceMode' | 'score' | 'scoreUnit'

  >,

): string {

  switch (exercise.activityType) {

    case 'strength': {

      const weightLabel = formatWeightWithUnit(exercise.weight, exercise.weightUnit);

      return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'} × ${exercise.reps} reps @ ${weightLabel || '0 lb'}`;

    }

    case 'cardio': {

      const durationLabel = formatDurationWithUnit(exercise.duration, exercise.durationUnit);

      const distanceLabel = formatCardioDistanceWithUnit(exercise.distance, exercise.distanceUnit);

      const mode = normalizeCardioDistanceMode(exercise.cardioDistanceMode);

      if (mode === 'per') {

        const perUnit = formatCardioPerDistanceUnit(exercise.distanceUnit);

        if (durationLabel && distanceLabel) {

          return `${durationLabel} per ${perUnit} for ${distanceLabel}`;

        }

        if (durationLabel && perUnit) {

          return `${durationLabel} per ${perUnit}`;

        }

      }

      const parts: string[] = [];

      if (durationLabel) {

        parts.push(durationLabel);

      }

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

      const scoreLabel = formatScoreWithUnit(exercise.score, exercise.scoreUnit);

      if (scoreLabel) {

        parts.push(scoreLabel);

      }

      return parts.length > 0 ? parts.join(', ') : 'No plan set';

    }

    case 'stretch': {

      const durationLabel = formatDurationWithUnit(exercise.duration, exercise.durationUnit);

      if (exercise.sets > 0 && durationLabel) {

        return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'} × ${durationLabel}`;

      }

      if (exercise.sets > 0) {

        return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'}`;

      }

      return durationLabel || 'No plan set';

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

    | 'weight'

    | 'weightUnit'

    | 'duration'

    | 'durationUnit'

    | 'distance'

    | 'distanceUnit'

    | 'score'

    | 'scoreUnit'

    | 'actualSets'

    | 'actualWeightUnit'

    | 'actualDuration'

    | 'actualDurationUnit'

    | 'actualDistance'

    | 'actualDistanceUnit'

    | 'actualScore'

    | 'actualScoreUnit'

    | 'actualStretchSets'

    | 'actualCardioPerSets'

    | 'cardioDistanceMode'

  >,

): string {

  switch (exercise.activityType) {

    case 'strength':

      return exercise.actualSets

        .map((set, index) => {

          const weightLabel = formatWeightWithUnit(set.actualWeight, exercise.actualWeightUnit);

          return `Set ${index + 1}: ${set.actualReps} reps @ ${weightLabel || '0 lb'}`;

        })

        .join(' · ');

    case 'cardio': {
      const mode = normalizeCardioDistanceMode(exercise.cardioDistanceMode);
      if (mode === 'per' && exercise.actualCardioPerSets.length > 0) {
        return exercise.actualCardioPerSets
          .map((set, index) => {
            const label = formatDurationWithUnit(set.actualDuration, set.actualDurationUnit);
            return `${cardioPerRowLabel(index, exercise.distanceUnit)}: ${label || 'Logged'}`;
          })
          .join(' · ');
      }

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

      const scoreLabel = formatScoreWithUnit(exercise.actualScore, exercise.actualScoreUnit);

      if (scoreLabel) {

        parts.push(scoreLabel);

      }

      return parts.length > 0 ? parts.join(', ') : 'Logged';

    }

    case 'stretch':

      return exercise.actualStretchSets

        .map((set, index) => {

          const label = formatDurationWithUnit(set.actualDuration, set.actualDurationUnit);

          return `Set ${index + 1}: ${label || 'Logged'}`;

        })

        .join(' · ');

    default:

      return 'Logged';

  }

}



export function activityTypeLabel(activityType: ActivityType): string {

  return ACTIVITY_TYPE_LABELS[activityType];

}


