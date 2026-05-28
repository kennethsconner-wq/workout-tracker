import { DISPLAY_DECIMAL_PLACES } from '@/lib/displayDecimals';

import {

  convertCardioDistance,

  DEFAULT_CARDIO_DISTANCE_UNIT,

  formatCardioDistanceValue,

  formatCardioDistanceWithUnit,

  formatCardioPerDistanceUnit,

  normalizeCardioDistanceUnit,

  parseCardioDistanceInput,

  usesIntegerDistanceInput,

  type CardioDistanceUnit,

} from '@/lib/cardioDistanceUnits';

import {

  isCardioDistancePerDuration,

  isCardioDurationPerDistance,

  isCardioPerSegmentLogging,

  readCardioPacePlan,

} from '@/lib/cardioPlan';

import {

  DEFAULT_DURATION_UNIT,

  durationToSeconds,

  formatDurationValue,

  normalizeDurationUnit,

  parseDurationInput,

  type DurationUnit,

} from '@/lib/durationUnits';

import type { LoggedCardioPerActualSet, WorkoutExercise } from '@/lib/types';



export type CardioPerSegmentExercise = Pick<

  WorkoutExercise,

  | 'activityType'

  | 'cardioObjective'

  | 'cardioDurationTracking'

  | 'cardioDistanceTracking'

  | 'cardioDistanceMode'

  | 'distance'

  | 'duration'

  | 'durationUnit'

  | 'distanceUnit'

  | 'cardioPaceDuration'

  | 'cardioPaceDurationUnit'

  | 'cardioPaceDistance'

  | 'cardioPaceDistanceUnit'

>;



export function isCardioPerMode(

  exercise: Pick<

    WorkoutExercise,

    'activityType' | 'cardioObjective' | 'cardioDurationTracking' | 'cardioDistanceTracking' | 'cardioDistanceMode'

  > &

    Partial<Pick<WorkoutExercise, 'duration' | 'distance'>>,

): boolean {

  return isCardioPerSegmentLogging(exercise);

}



export function cardioPerSegmentUsesIntegerObjectiveUnits(exercise: CardioPerSegmentExercise): boolean {

  const pace = readCardioPacePlan(exercise);

  if (pace) {

    return usesIntegerDistanceInput(pace.distanceUnit);

  }

  if (isCardioDurationPerDistance(exercise)) {

    return usesIntegerDistanceInput(exercise.distanceUnit);

  }

  return false;

}



function cardioPaceSegmentDistanceTotal(

  exercise: CardioPerSegmentExercise,

  actualObjectiveInput: string,

): number {

  const pace = readCardioPacePlan(exercise);

  if (!pace || pace.distance <= 0) {

    return 1;

  }



  if (isCardioDurationPerDistance(exercise)) {

    const objectiveDistanceTotal = resolveCardioPerSegmentObjectiveTotal(exercise, actualObjectiveInput);

    const converted = convertCardioDistance(objectiveDistanceTotal, exercise.distanceUnit, pace.distanceUnit);

    if (converted === null) {

      if (exercise.distanceUnit === pace.distanceUnit) {

        return objectiveDistanceTotal / pace.distance;

      }

      return objectiveDistanceTotal;

    }

    return converted / pace.distance;

  }



  const durationTotal = resolveCardioPerSegmentObjectiveTotal(exercise, actualObjectiveInput);

  const objectiveSeconds = durationToSeconds(durationTotal, exercise.durationUnit);

  const paceSeconds = durationToSeconds(pace.duration, pace.durationUnit);

  if (!objectiveSeconds || !paceSeconds) {

    return durationTotal / pace.duration;

  }

  return objectiveSeconds / paceSeconds;

}



export function cardioPerSegmentCountForObjectiveTotal(total: number, usesIntegerUnits: boolean): number {

  if (!Number.isFinite(total) || total <= 0) {

    return 1;

  }

  const fullUnits = Math.floor(total);

  const hasPartial = !usesIntegerUnits && total - fullUnits > 1e-9;

  return Math.max(1, fullUnits + (hasPartial ? 1 : 0));

}



export function resolveCardioPerSegmentObjectiveTotal(

  exercise: CardioPerSegmentExercise,

  actualObjectiveInput: string,

): number {

  const trimmed = actualObjectiveInput.trim();

  if (trimmed.length > 0) {

    const parsed = isCardioDurationPerDistance(exercise)

      ? parseCardioDistanceInput(trimmed, exercise.distanceUnit)

      : parseDurationInput(trimmed, exercise.durationUnit);

    if (Number.isFinite(parsed) && parsed > 0) {

      return parsed;

    }

  }

  if (isCardioDurationPerDistance(exercise)) {

    return exercise.distance > 0 ? exercise.distance : 1;

  }

  if (isCardioDistancePerDuration(exercise)) {

    return exercise.duration > 0 ? exercise.duration : 1;

  }

  return 1;

}



export function cardioPerSegmentCount(

  exercise: CardioPerSegmentExercise,

  actualObjectiveInput = '',

): number {

  if (!isCardioPerSegmentLogging(exercise)) {

    return 0;

  }

  const distanceTotal = cardioPaceSegmentDistanceTotal(exercise, actualObjectiveInput);

  return cardioPerSegmentCountForObjectiveTotal(

    distanceTotal,

    cardioPerSegmentUsesIntegerObjectiveUnits(exercise),

  );

}



export function cardioPerRowLabel(
  setIndex: number,
  paceDistance: number,
  paceDistanceUnit: CardioDistanceUnit,
): string {
  const unit = normalizeCardioDistanceUnit(paceDistanceUnit);
  const chunkLabel =
    paceDistance === 1
      ? formatCardioPerDistanceUnit(unit)
      : formatCardioDistanceWithUnit(paceDistance, unit);
  const capitalized = chunkLabel.charAt(0).toUpperCase() + chunkLabel.slice(1);
  return `${capitalized} ${setIndex + 1}`;
}



export function cardioPerSegmentLabel(

  setIndex: number,

  segmentCount: number,

  objectiveTotal: number,

  exercise: CardioPerSegmentExercise,

): string {

  const pace = readCardioPacePlan(exercise);

  const distanceTotal = cardioPaceSegmentDistanceTotal(exercise, String(objectiveTotal));

  const usesInteger = cardioPerSegmentUsesIntegerObjectiveUnits(exercise);

  const fullUnits = Math.floor(distanceTotal);

  const hasPartial = !usesInteger && distanceTotal - fullUnits > 1e-9;

  const isLastPartial = hasPartial && setIndex === segmentCount - 1;

  const paceDistance = pace?.distance ?? 1;

  const paceDistanceUnit = pace?.distanceUnit ?? exercise.distanceUnit;



  if (isLastPartial && pace) {

    const partialAmount = (distanceTotal - fullUnits) * paceDistance;

    return formatCardioDistanceWithUnit(partialAmount, paceDistanceUnit);

  }



  return cardioPerRowLabel(setIndex, paceDistance, paceDistanceUnit);

}



export function cardioPerSegmentObjectiveInput(exercise: CardioPerSegmentExercise): 'actualDistanceInput' | 'actualDurationInput' {

  return perSegmentObjectiveInputValue(exercise);

}



export type DraftCardioPerActualSetFields = {

  actualDurationInput: string;

  actualDurationUnit: DurationUnit;

  actualDistanceInput: string;

  actualDistanceUnit: CardioDistanceUnit;

};



export function buildDraftCardioPerActualSets(

  exercise: CardioPerSegmentExercise,

  loggedSets: LoggedCardioPerActualSet[],

  actualObjectiveInput = '',

): DraftCardioPerActualSetFields[] {

  const pace = readCardioPacePlan(exercise);

  const count = cardioPerSegmentCount(exercise, actualObjectiveInput);

  return Array.from({ length: count }, (_, setIndex) => {

    const logged = loggedSets[setIndex];

    return {

      actualDurationInput:

        logged && logged.actualDuration > 0

          ? formatDurationValue(
              logged.actualDuration,
              pace?.durationUnit ?? logged.actualDurationUnit,
            )

          : '',

      actualDurationUnit:
        pace?.durationUnit ??
        logged?.actualDurationUnit ??
        normalizeDurationUnit(exercise.durationUnit),

      actualDistanceInput: '',

      actualDistanceUnit: pace?.distanceUnit ?? exercise.distanceUnit,

    };

  });

}



export function perSegmentObjectiveInputValue(

  exercise: CardioPerSegmentExercise,

): 'actualDistanceInput' | 'actualDurationInput' {

  return isCardioDurationPerDistance(exercise) ? 'actualDistanceInput' : 'actualDurationInput';

}



export function resizeDraftCardioPerSets<T extends DraftCardioPerActualSetFields>(

  exercise: CardioPerSegmentExercise,

  existing: T[],

  actualObjectiveInput: string,

  createRow: (fields: DraftCardioPerActualSetFields) => T,

): T[] {

  const newCount = cardioPerSegmentCount(exercise, actualObjectiveInput);

  if (existing.length === newCount) {

    return existing;

  }

  if (existing.length > newCount) {

    return existing.slice(0, newCount);

  }

  const built = buildDraftCardioPerActualSets(exercise, [], actualObjectiveInput);

  const next = [...existing];

  for (let index = existing.length; index < newCount; index++) {

    next.push(createRow(built[index] ?? built[built.length - 1]));

  }

  return next;

}



export function readActualCardioPerSetsFromStored(exercise: Record<string, unknown>): LoggedCardioPerActualSet[] {

  const raw = exercise.actualCardioPerSets;

  if (Array.isArray(raw) && raw.length > 0) {

    return raw

      .map((item) => {

        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};

        const actualDuration = typeof row.actualDuration === 'number' ? row.actualDuration : 0;

        const actualDistance = typeof row.actualDistance === 'number' ? row.actualDistance : 0;

        if (actualDuration <= 0 && actualDistance <= 0) {

          return null;

        }

        return {

          actualDuration,

          actualDurationUnit: normalizeDurationUnit(row.actualDurationUnit),

          actualDistance,

          actualDistanceUnit: normalizeCardioDistanceUnit(row.actualDistanceUnit),

        };

      })

      .filter((item): item is LoggedCardioPerActualSet => item !== null);

  }

  return [];

}


