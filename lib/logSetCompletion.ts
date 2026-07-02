import {
  getCardioLogLayout,
  isCardioDurationPerDistance,
  isCardioPaceTracking,
} from '@/lib/cardioPlan';
import type { LogExerciseDraftFields } from '@/lib/logExerciseDraft';
import {
  normalizeCardioDurationUnit,
  normalizeDurationUnit,
  parseCardioDistanceInput,
  parseDurationInput,
} from '@/lib/durationUnits';

export function isDraftStrengthSetEmpty(set: { actualRepsInput: string; actualWeightInput: string }): boolean {
  return set.actualRepsInput.trim().length === 0 && set.actualWeightInput.trim().length === 0;
}

export function isDraftStrengthSetComplete(set: { actualRepsInput: string; actualWeightInput: string }): boolean {
  const actualReps = Number.parseInt(set.actualRepsInput.trim(), 10);
  const actualWeight = Number.parseFloat(set.actualWeightInput.trim().replace(',', '.'));
  return Number.isFinite(actualReps) && actualReps > 0 && Number.isFinite(actualWeight) && actualWeight >= 0;
}

export function isDraftStretchSetEmpty(set: { actualDurationInput: string }): boolean {
  return set.actualDurationInput.trim().length === 0;
}

export function isDraftStretchSetComplete(set: {
  actualDurationInput: string;
  actualDurationUnit: LogExerciseDraftFields['actualStretchSets'][number]['actualDurationUnit'];
}): boolean {
  const actualDuration = parseDurationInput(set.actualDurationInput, normalizeDurationUnit(set.actualDurationUnit));
  return Number.isFinite(actualDuration) && actualDuration > 0;
}

export function isDraftCardioPerSegmentObjectiveComplete(exercise: LogExerciseDraftFields): boolean {
  if (exercise.activityType !== 'cardio' || getCardioLogLayout(exercise) !== 'per_segment') {
    return false;
  }
  if (isCardioDurationPerDistance(exercise)) {
    const parsed = parseCardioDistanceInput(exercise.actualDistanceInput, exercise.actualDistanceUnit);
    return Number.isFinite(parsed) && parsed > 0;
  }
  const parsed = parseDurationInput(exercise.actualDurationInput, exercise.actualDurationUnit);
  return Number.isFinite(parsed) && parsed > 0;
}

export function isDraftCardioPerSegmentSetEmpty(set: { actualDurationInput: string }): boolean {
  return set.actualDurationInput.trim().length === 0;
}

export function isDraftCardioPerSegmentSetComplete(
  exercise: LogExerciseDraftFields,
  set: LogExerciseDraftFields['actualCardioPerSets'][number],
): boolean {
  if (!isCardioPaceTracking(exercise)) {
    return true;
  }
  const actualDuration = parseDurationInput(
    set.actualDurationInput,
    normalizeCardioDurationUnit(set.actualDurationUnit),
  );
  return Number.isFinite(actualDuration) && actualDuration > 0;
}

export function getActiveSetIndexForStrength(exercise: LogExerciseDraftFields): number {
  for (let setIndex = 0; setIndex < exercise.actualSets.length; setIndex++) {
    if (!isDraftStrengthSetComplete(exercise.actualSets[setIndex])) {
      return setIndex;
    }
  }
  return Math.max(0, exercise.actualSets.length - 1);
}

export function getActiveSetIndexForStretch(exercise: LogExerciseDraftFields): number {
  for (let setIndex = 0; setIndex < exercise.actualStretchSets.length; setIndex++) {
    if (!isDraftStretchSetComplete(exercise.actualStretchSets[setIndex])) {
      return setIndex;
    }
  }
  return Math.max(0, exercise.actualStretchSets.length - 1);
}

export type CardioPerSegmentLockState = {
  objectiveEditable: boolean;
  activeSegmentIndex: number;
};

export function getCardioPerSegmentLockState(exercise: LogExerciseDraftFields): CardioPerSegmentLockState {
  if (!isDraftCardioPerSegmentObjectiveComplete(exercise)) {
    return { objectiveEditable: true, activeSegmentIndex: -1 };
  }

  for (let setIndex = 0; setIndex < exercise.actualCardioPerSets.length; setIndex++) {
    if (!isDraftCardioPerSegmentSetComplete(exercise, exercise.actualCardioPerSets[setIndex])) {
      return { objectiveEditable: false, activeSegmentIndex: setIndex };
    }
  }

  return {
    objectiveEditable: false,
    activeSegmentIndex: Math.max(0, exercise.actualCardioPerSets.length - 1),
  };
}

export type ExerciseSetLockState = {
  lockingEnabled: boolean;
  strengthActiveSetIndex: number;
  stretchActiveSetIndex: number;
  cardioPerSegment: CardioPerSegmentLockState;
};

export function getExerciseSetLockState(
  exercise: LogExerciseDraftFields,
  lockingEnabled: boolean,
): ExerciseSetLockState {
  if (!lockingEnabled) {
    return {
      lockingEnabled: false,
      strengthActiveSetIndex: 0,
      stretchActiveSetIndex: 0,
      cardioPerSegment: { objectiveEditable: true, activeSegmentIndex: 0 },
    };
  }

  return {
    lockingEnabled: true,
    strengthActiveSetIndex: getActiveSetIndexForStrength(exercise),
    stretchActiveSetIndex: getActiveSetIndexForStretch(exercise),
    cardioPerSegment: getCardioPerSegmentLockState(exercise),
  };
}

export function isStrengthSetEditable(state: ExerciseSetLockState, setIndex: number): boolean {
  return !state.lockingEnabled || setIndex <= state.strengthActiveSetIndex;
}

export function isStretchSetEditable(state: ExerciseSetLockState, setIndex: number): boolean {
  return !state.lockingEnabled || setIndex <= state.stretchActiveSetIndex;
}

/** Objective total stays editable; segment rows lock until the objective is complete. */
export function isCardioPerSegmentObjectiveEditable(_state: ExerciseSetLockState): boolean {
  return true;
}

export function isCardioPerSegmentSetEditable(state: ExerciseSetLockState, setIndex: number): boolean {
  if (!state.lockingEnabled) {
    return true;
  }
  const { activeSegmentIndex } = state.cardioPerSegment;
  if (activeSegmentIndex < 0) {
    return false;
  }
  return setIndex <= activeSegmentIndex;
}

export function isRestAfterSetEditable(
  state: ExerciseSetLockState,
  afterSetIndex: number,
  activityType: 'strength' | 'stretch',
): boolean {
  if (!state.lockingEnabled) {
    return true;
  }
  const frontierSetIndex =
    activityType === 'strength' ? state.strengthActiveSetIndex : state.stretchActiveSetIndex;
  return afterSetIndex + 1 <= frontierSetIndex;
}

export function canAddStrengthSet(state: ExerciseSetLockState, exercise: LogExerciseDraftFields): boolean {
  if (!state.lockingEnabled || exercise.actualSets.length === 0) {
    return true;
  }
  const lastIndex = exercise.actualSets.length - 1;
  return (
    state.strengthActiveSetIndex === lastIndex &&
    isDraftStrengthSetComplete(exercise.actualSets[lastIndex])
  );
}

export function canAddStretchSet(state: ExerciseSetLockState, exercise: LogExerciseDraftFields): boolean {
  if (!state.lockingEnabled || exercise.actualStretchSets.length === 0) {
    return true;
  }
  const lastIndex = exercise.actualStretchSets.length - 1;
  return (
    state.stretchActiveSetIndex === lastIndex &&
    isDraftStretchSetComplete(exercise.actualStretchSets[lastIndex])
  );
}
