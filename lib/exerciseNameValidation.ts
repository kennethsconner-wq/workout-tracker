import { exerciseDefinitionSignatureKey, type ExerciseDefinitionFields } from '@/lib/exerciseSnapshot';
import type { Workout, WorkoutExercise } from '@/lib/types';

export type ExerciseDefinitionRef = {
  name: string;
  signature: string;
};

export function normalizedExerciseName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function exerciseDefinitionRef(exercise: ExerciseDefinitionFields): ExerciseDefinitionRef {
  return {
    name: exercise.name,
    signature: exerciseDefinitionSignatureKey(exercise),
  };
}

export function validateUniqueExerciseNamesAmong(
  refs: readonly ExerciseDefinitionRef[],
): { ok: true } | { ok: false; title: string; message: string } {
  const byName = new Map<string, string>();
  for (const ref of refs) {
    const norm = normalizedExerciseName(ref.name);
    if (!norm) {
      continue;
    }
    const prev = byName.get(norm);
    if (prev === undefined) {
      byName.set(norm, ref.signature);
      continue;
    }
    if (prev !== ref.signature) {
      const displayName = ref.name.trim();
      return {
        ok: false,
        title: 'Exercise name already in use',
        message: `"${displayName}" is already used by another exercise with different settings. Choose a unique name or match the existing exercise exactly.`,
      };
    }
  }
  return { ok: true };
}

export function collectExerciseDefinitionRefsFromWorkouts(
  workouts: readonly Workout[],
  options?: {
    replaceWorkoutId?: string;
    replaceExercises?: readonly WorkoutExercise[];
  },
): ExerciseDefinitionRef[] {
  const refs: ExerciseDefinitionRef[] = [];
  for (const workout of workouts) {
    const exercises =
      options?.replaceWorkoutId && workout.id === options.replaceWorkoutId
        ? (options.replaceExercises ?? [])
        : workout.exercises;
    for (const ex of exercises) {
      refs.push(exerciseDefinitionRef(ex));
    }
  }
  return refs;
}

/** Validate names when saving a workout (create or edit). Duplicate slots with the same definition are allowed. */
export function validateExerciseNamesForWorkoutSave(
  workouts: readonly Workout[],
  editingWorkoutId: string | null,
  parsedExercises: readonly WorkoutExercise[],
): { ok: true } | { ok: false; title: string; message: string } {
  if (editingWorkoutId) {
    const refs = collectExerciseDefinitionRefsFromWorkouts(workouts, {
      replaceWorkoutId: editingWorkoutId,
      replaceExercises: parsedExercises,
    });
    return validateUniqueExerciseNamesAmong(refs);
  }

  const refs = [
    ...collectExerciseDefinitionRefsFromWorkouts(workouts),
    ...parsedExercises.map((exercise) => exerciseDefinitionRef(exercise)),
  ];
  return validateUniqueExerciseNamesAmong(refs);
}

/** Validate names after editing an exercise definition from the library. */
export function validateExerciseNamesAfterLibraryEdit(
  workouts: readonly Workout[],
  matchesOldDefinition: (exercise: WorkoutExercise) => boolean,
  nextExercise: WorkoutExercise,
): { ok: true } | { ok: false; title: string; message: string } {
  const nextRef = exerciseDefinitionRef(nextExercise);
  const refs: ExerciseDefinitionRef[] = [];
  for (const workout of workouts) {
    for (const ex of workout.exercises) {
      refs.push(matchesOldDefinition(ex) ? nextRef : exerciseDefinitionRef(ex));
    }
  }
  return validateUniqueExerciseNamesAmong(refs);
}
