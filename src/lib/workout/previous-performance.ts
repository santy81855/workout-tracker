import type { ActiveSessionExercise, ActiveWorkoutSession, WorkoutSetDraft } from "./types";

function completedSets(exercise: ActiveSessionExercise) {
  return exercise.sets.filter((set) => set.status === "completed");
}

export function findPreviousExercise(
  sessions: ActiveWorkoutSession[],
  exerciseSlug: string,
  options: { beforeSequence?: number; excludeDeload?: boolean } = {},
): { session: ActiveWorkoutSession; exercise: ActiveSessionExercise } | null {
  const candidates = sessions
    .filter((session) => session.status !== "active")
    .filter((session) => options.beforeSequence === undefined || session.sequenceInCycle < options.beforeSequence)
    .filter((session) => !options.excludeDeload || session.programWeek !== 12)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));

  for (const session of candidates) {
    const exercise = session.exercises.find((item) =>
      item.performedExerciseSlug === exerciseSlug && completedSets(item).length > 0,
    );
    if (exercise) return { session, exercise };
  }
  return null;
}

function priorLoad(priorSets: WorkoutSetDraft[], setIndex: number) {
  return priorSets[setIndex] ?? priorSets.at(-1) ?? null;
}

export function applyPreviousLoads(
  session: ActiveWorkoutSession,
  history: ActiveWorkoutSession[],
): ActiveWorkoutSession {
  return {
    ...session,
    exercises: session.exercises.map((exercise) => {
      const eligibleHistory = history.filter((candidate) =>
        candidate.programSlug !== session.programSlug
        || candidate.cycleStartsOn !== session.cycleStartsOn
        || candidate.sequenceInCycle < session.sequenceInCycle,
      );
      const previous = findPreviousExercise(eligibleHistory, exercise.performedExerciseSlug, { excludeDeload: true });
      if (!previous || previous.exercise.loadBasis !== exercise.loadBasis) return exercise;
      const priorSets = completedSets(previous.exercise);
      return {
        ...exercise,
        sets: exercise.sets.map((set, setIndex) => {
          const prior = priorLoad(priorSets, setIndex);
          if (!prior) return set;
          return { ...set, loadMode: prior.loadMode, loadTenthsLb: prior.loadTenthsLb };
        }),
      };
    }),
  };
}

export function formatPreviousSets(exercise: ActiveSessionExercise): string {
  return completedSets(exercise)
    .map((set) => {
      const load = set.loadMode === "bodyweight_only" ? "BW" : `${(set.loadTenthsLb ?? 0) / 10} lb`;
      const rir = set.rirOnTarget === true ? "target RIR" : set.actualRir === null ? "RIR —" : `RIR ${set.actualRir}`;
      return `${load} × ${set.reps} (${rir})`;
    })
    .join(" · ");
}
