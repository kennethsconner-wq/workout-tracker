import type { ActivityType } from '@/lib/activityTypes';
import { ACTIVITY_TYPE_LABELS } from '@/lib/activityTypes';
import { formatCardioDistanceWithUnit } from '@/lib/cardioDistanceUnits';
import { cardioPerSegmentLabel } from '@/lib/cardioPerLog';
import {
  formatPlannedCardioSummary,
  getCardioLogLayout,
  isCardioDistancePerDuration,
  isCardioDurationPerDistance,
} from '@/lib/cardioPlan';
import { formatDurationWithUnit } from '@/lib/durationUnits';
import { formatScoreWithUnit } from '@/lib/scoreUnits';
import { readStretchSetsFromExercise } from '@/lib/stretchSets';
import { formatWeightWithUnit } from '@/lib/weightUnits';
import type { LoggedWorkoutExercise, WorkoutExercise } from '@/lib/types';

type PlannedExerciseFields = Pick<
  WorkoutExercise,
  | 'activityType'
  | 'sets'
  | 'reps'
  | 'weight'
  | 'weightUnit'
  | 'duration'
  | 'durationUnit'
  | 'distance'
  | 'distanceUnit'
  | 'cardioObjective'
  | 'cardioDurationTracking'
  | 'cardioDistanceTracking'
  | 'cardioDistanceMode'
  | 'score'
  | 'scoreUnit'
  | 'stretchSets'
>;

type LoggedExerciseFields = Pick<
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
  | 'cardioObjective'
  | 'cardioDurationTracking'
  | 'cardioDistanceTracking'
  | 'cardioDistanceMode'
  | 'stretchSets'
>;

export type LogExerciseDetailRow = {
  key: string;
  label: string;
  actual: string;
};

export type LogExerciseLogDisplay = {
  plannedSummary: string;
  actualSummary: string;
  rows: LogExerciseDetailRow[];
};

export function formatPlannedExerciseSummary(exercise: PlannedExerciseFields): string {
  switch (exercise.activityType) {
    case 'strength': {
      const weightLabel = formatWeightWithUnit(exercise.weight, exercise.weightUnit);
      return `${exercise.sets} set${exercise.sets === 1 ? '' : 's'} × ${exercise.reps} reps @ ${weightLabel || '0 lb'}`;
    }
    case 'cardio':
      return formatPlannedCardioSummary(exercise);
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
      const plannedSets = readStretchSetsFromExercise(exercise);
      if (plannedSets.length > 1) {
        const unique = new Set(
          plannedSets.map((set) => formatDurationWithUnit(set.duration, set.durationUnit)),
        );
        if (unique.size === 1 && plannedSets[0]) {
          const durationLabel = formatDurationWithUnit(
            plannedSets[0].duration,
            plannedSets[0].durationUnit,
          );
          return `${plannedSets.length} set${plannedSets.length === 1 ? '' : 's'} × ${durationLabel}`;
        }
      }
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

export function formatLoggedExerciseSummary(exercise: LoggedExerciseFields): string {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets
        .map((set, index) => {
          const weightLabel = formatWeightWithUnit(set.actualWeight, exercise.actualWeightUnit);
          return `Set ${index + 1}: ${set.actualReps} reps @ ${weightLabel || '0 lb'}`;
        })
        .join(' · ');
    case 'cardio': {
      if (isCardioDurationPerDistance(exercise) && exercise.actualCardioPerSets.length > 0) {
        const objectiveTotal =
          exercise.actualDistance > 0 ? exercise.actualDistance : exercise.distance;
        const segments = exercise.actualCardioPerSets
          .map((set, index) => {
            const label = formatDurationWithUnit(set.actualDuration, set.actualDurationUnit);
            const rowLabel = cardioPerSegmentLabel(
              index,
              exercise.actualCardioPerSets.length,
              objectiveTotal,
              exercise,
            );
            return `${rowLabel}: ${label || 'Logged'}`;
          })
          .join(' · ');
        const totalLabel = formatCardioDistanceWithUnit(exercise.actualDistance, exercise.actualDistanceUnit);
        return totalLabel ? `${totalLabel} · ${segments}` : segments;
      }
      if (isCardioDistancePerDuration(exercise) && exercise.actualCardioPerSets.length > 0) {
        const objectiveTotal =
          exercise.actualDuration > 0 ? exercise.actualDuration : exercise.duration;
        const segments = exercise.actualCardioPerSets
          .map((set, index) => {
            const label = formatCardioDistanceWithUnit(set.actualDistance, set.actualDistanceUnit);
            const rowLabel = cardioPerSegmentLabel(
              index,
              exercise.actualCardioPerSets.length,
              objectiveTotal,
              exercise,
            );
            return `${rowLabel}: ${label || 'Logged'}`;
          })
          .join(' · ');
        const totalLabel = formatDurationWithUnit(exercise.actualDuration, exercise.actualDurationUnit);
        return totalLabel ? `${totalLabel} · ${segments}` : segments;
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

export function hasLoggedExerciseActual(exercise: LoggedWorkoutExercise): boolean {
  switch (exercise.activityType) {
    case 'strength':
      return exercise.actualSets.length > 0;
    case 'cardio': {
      const layout = getCardioLogLayout(exercise);
      if (layout === 'per_segment') {
        return (
          exercise.actualCardioPerSets.length > 0 ||
          exercise.actualDistance > 0 ||
          exercise.actualDuration > 0
        );
      }
      return exercise.actualDuration > 0 || exercise.actualDistance > 0;
    }
    case 'sport':
      return exercise.actualDuration > 0 || exercise.actualScore.trim().length > 0;
    case 'stretch':
      return exercise.actualStretchSets.length > 0;
    default:
      return false;
  }
}

export function formatLogExerciseActualSummary(exercise: LoggedWorkoutExercise): string {
  if (!hasLoggedExerciseActual(exercise)) {
    return '—';
  }
  const summary = formatLoggedExerciseSummary(exercise);
  if (!summary || summary === 'Logged') {
    return '—';
  }
  return summary;
}

function formatStrengthSetSummary(reps: number, weight: number, weightUnit: LoggedWorkoutExercise['weightUnit']): string {
  const weightLabel = formatWeightWithUnit(weight, weightUnit);
  return `${reps} reps @ ${weightLabel || '0 lb'}`;
}

function loggedCardioPerSegmentObjectiveTotal(exercise: LoggedWorkoutExercise): number {
  if (isCardioDurationPerDistance(exercise)) {
    return exercise.actualDistance > 0
      ? exercise.actualDistance
      : exercise.distance > 0
        ? exercise.distance
        : 1;
  }
  return exercise.actualDuration > 0
    ? exercise.actualDuration
    : exercise.duration > 0
      ? exercise.duration
      : 1;
}

function cardioPerSegmentTotalRowLabel(exercise: LoggedWorkoutExercise): string {
  return isCardioDurationPerDistance(exercise) ? 'Total distance' : 'Total duration';
}

function cardioPerSegmentTotalActual(exercise: LoggedWorkoutExercise): string {
  if (isCardioDurationPerDistance(exercise)) {
    return formatCardioDistanceWithUnit(exercise.actualDistance, exercise.actualDistanceUnit) || '—';
  }
  return formatDurationWithUnit(exercise.actualDuration, exercise.actualDurationUnit) || '—';
}

function cardioPerSegmentFieldActual(
  set: LoggedWorkoutExercise['actualCardioPerSets'][number],
  exercise: LoggedWorkoutExercise,
): string {
  if (isCardioDurationPerDistance(exercise)) {
    return formatDurationWithUnit(set.actualDuration, set.actualDurationUnit) || '—';
  }
  return formatCardioDistanceWithUnit(set.actualDistance, set.actualDistanceUnit) || '—';
}

export function getLogExerciseLogDisplay(exercise: LoggedWorkoutExercise): LogExerciseLogDisplay {
  const plannedSummary = formatPlannedExerciseSummary(exercise);

  switch (exercise.activityType) {
    case 'strength': {
      const rows = exercise.actualSets.map((set, index) => ({
        key: `set-${index}`,
        label: `Set ${index + 1}`,
        actual: formatStrengthSetSummary(set.actualReps, set.actualWeight, exercise.actualWeightUnit),
      }));
      return {
        plannedSummary,
        actualSummary: formatLogExerciseActualSummary(exercise),
        rows,
      };
    }
    case 'stretch': {
      const rows = exercise.actualStretchSets.map((set, index) => ({
        key: `set-${index}`,
        label: `Set ${index + 1}`,
        actual: formatDurationWithUnit(set.actualDuration, set.actualDurationUnit) || '—',
      }));
      return {
        plannedSummary,
        actualSummary: formatLogExerciseActualSummary(exercise),
        rows,
      };
    }
    case 'cardio': {
      const layout = getCardioLogLayout(exercise);
      if (layout === 'per_segment') {
        const objectiveTotal = loggedCardioPerSegmentObjectiveTotal(exercise);
        const segmentCount = exercise.actualCardioPerSets.length;
        const rows: LogExerciseDetailRow[] = [
          {
            key: 'total',
            label: cardioPerSegmentTotalRowLabel(exercise),
            actual: cardioPerSegmentTotalActual(exercise),
          },
          ...exercise.actualCardioPerSets.map((set, index) => ({
            key: `segment-${index}`,
            label: cardioPerSegmentLabel(index, segmentCount, objectiveTotal, exercise),
            actual: cardioPerSegmentFieldActual(set, exercise),
          })),
        ];
        return {
          plannedSummary,
          actualSummary: formatLogExerciseActualSummary(exercise),
          rows,
        };
      }

      return {
        plannedSummary,
        actualSummary: formatLogExerciseActualSummary(exercise),
        rows: [],
      };
    }
    default:
      return {
        plannedSummary,
        actualSummary: formatLogExerciseActualSummary(exercise),
        rows: [],
      };
  }
}

export function activityTypeLabel(activityType: ActivityType): string {
  return ACTIVITY_TYPE_LABELS[activityType];
}
