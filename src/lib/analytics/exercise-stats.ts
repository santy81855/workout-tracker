import type { ActiveWorkoutSession } from "@/lib/workout/types";

export interface ExerciseStats {
  slug: string;
  name: string;
  sessions: number;
  completedSets: number;
  highestLoadTenthsLb: number | null;
  highestLoadMode: string | null;
  mostReps: number;
  bestSetVolumeTenths: number | null;
}

export function calculateExerciseStats(sessions: ActiveWorkoutSession[]): ExerciseStats[] {
  const stats = new Map<string, ExerciseStats & { sessionIds: Set<string> }>();
  for (const session of sessions.filter((item) => item.status !== "active")) {
    for (const exercise of session.exercises) {
      const sets = exercise.sets.filter((set) => set.status === "completed");
      if (sets.length === 0) continue;
      const current = stats.get(exercise.performedExerciseSlug) ?? {
        slug: exercise.performedExerciseSlug,
        name: exercise.name,
        sessions: 0,
        completedSets: 0,
        highestLoadTenthsLb: null,
        highestLoadMode: null,
        mostReps: 0,
        bestSetVolumeTenths: null,
        sessionIds: new Set<string>(),
      };
      current.sessionIds.add(session.id);
      current.completedSets += sets.length;
      for (const set of sets) {
        current.mostReps = Math.max(current.mostReps, set.reps);
        if (set.loadTenthsLb !== null && (current.highestLoadTenthsLb === null || set.loadTenthsLb > current.highestLoadTenthsLb)) {
          current.highestLoadTenthsLb = set.loadTenthsLb;
          current.highestLoadMode = set.loadMode;
        }
        if (set.loadTenthsLb !== null) {
          const volume = set.loadTenthsLb * set.reps;
          current.bestSetVolumeTenths = Math.max(current.bestSetVolumeTenths ?? 0, volume);
        }
      }
      stats.set(current.slug, current);
    }
  }
  return [...stats.values()]
    .map(({ sessionIds, ...item }) => ({ ...item, sessions: sessionIds.size }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
