import {
  CARDIO_DURATION_UNITS,
  DURATION_UNIT_ABBREVIATIONS,
  durationToSeconds,
  formatDurationValue,
  isCardioDurationUnit,
  normalizeCardioDurationUnit,
  parseDurationInput,
  type CardioDurationUnit,
  type DurationUnit,
} from '@/lib/durationUnits';
import { resolvePlannedDurationLogTimerConfig, type DurationLogTimerConfig } from '@/lib/durationTimer';

export const REST_DURATION_UNITS = CARDIO_DURATION_UNITS;
export type RestDurationUnit = CardioDurationUnit;

export const DEFAULT_REST_DURATION_UNIT: RestDurationUnit = 'seconds';

export type RestBetweenSetsFields = {
  restBetweenSetsEnabled?: boolean;
  restDuration?: number;
  restDurationUnit?: DurationUnit;
};

export function normalizeRestDurationUnit(value: unknown): RestDurationUnit {
  return normalizeCardioDurationUnit(value);
}

export function hasRestBetweenSetsConfigured(exercise: RestBetweenSetsFields): boolean {
  if (!exercise.restBetweenSetsEnabled) {
    return false;
  }
  const unit = normalizeRestDurationUnit(exercise.restDurationUnit);
  const seconds = durationToSeconds(exercise.restDuration ?? 0, unit);
  return seconds !== null && seconds > 0;
}

export function readRestBetweenSetsFromStored(
  raw: Record<string, unknown>,
  activityType: string,
): RestBetweenSetsFields {
  if (activityType !== 'strength' && activityType !== 'stretch') {
    return {};
  }
  const enabled = raw.restBetweenSetsEnabled === true;
  if (!enabled) {
    return { restBetweenSetsEnabled: false };
  }
  const restDuration = typeof raw.restDuration === 'number' && raw.restDuration > 0 ? raw.restDuration : 0;
  const restDurationUnit = normalizeRestDurationUnit(raw.restDurationUnit);
  if (restDuration <= 0) {
    return { restBetweenSetsEnabled: false };
  }
  return {
    restBetweenSetsEnabled: true,
    restDuration,
    restDurationUnit,
  };
}

export function sanitizeRestBetweenSetsFields(
  exercise: RestBetweenSetsFields & { activityType: string },
): RestBetweenSetsFields {
  if (exercise.activityType !== 'strength' && exercise.activityType !== 'stretch') {
    return {};
  }
  if (!hasRestBetweenSetsConfigured(exercise)) {
    return { restBetweenSetsEnabled: false };
  }
  return {
    restBetweenSetsEnabled: true,
    restDuration: exercise.restDuration,
    restDurationUnit: normalizeRestDurationUnit(exercise.restDurationUnit),
  };
}

export function formatRestBetweenSetsPlanLine(exercise: RestBetweenSetsFields): string | null {
  if (!hasRestBetweenSetsConfigured(exercise)) {
    return null;
  }
  const unit = normalizeRestDurationUnit(exercise.restDurationUnit);
  const label = formatDurationValue(exercise.restDuration ?? 0, unit);
  if (!label) {
    return null;
  }
  return `${label} ${DURATION_UNIT_ABBREVIATIONS[unit]} rest between sets`;
}

export function resolveRestBetweenSetsTimerConfig(exercise: RestBetweenSetsFields): DurationLogTimerConfig {
  if (!hasRestBetweenSetsConfigured(exercise)) {
    return { timerMode: 'countup', countdownTargetSeconds: null };
  }
  const unit = normalizeRestDurationUnit(exercise.restDurationUnit);
  return resolvePlannedDurationLogTimerConfig({
    duration: exercise.restDuration ?? 0,
    durationUnit: unit,
  });
}

export function parseRestDurationFromDraftInput(
  raw: string,
  unit: DurationUnit,
): { ok: true; restDuration: number; restDurationUnit: RestDurationUnit } | { ok: false } {
  if (!isCardioDurationUnit(unit)) {
    return { ok: false };
  }
  const restDuration = parseDurationInput(raw, unit);
  if (!Number.isFinite(restDuration) || restDuration <= 0) {
    return { ok: false };
  }
  return { ok: true, restDuration, restDurationUnit: unit };
}

export function restDurationToDraftInput(
  restDuration: number | undefined,
  restDurationUnit: DurationUnit | undefined,
): string {
  if (!restDuration || restDuration <= 0) {
    return '';
  }
  const unit = normalizeRestDurationUnit(restDurationUnit);
  return formatDurationValue(restDuration, unit);
}

export function restBetweenSetsTimerId(
  activityType: 'strength' | 'stretch',
  exerciseId: string,
  afterSetIndex: number,
): string {
  return `rest:${activityType}:${exerciseId}:after:${afterSetIndex}`;
}
