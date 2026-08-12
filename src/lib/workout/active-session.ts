import type { ActiveWorkoutSession } from "./types";

export function selectCycleActiveSession(
  localActive: ActiveWorkoutSession | null,
  availableSessions: ActiveWorkoutSession[],
  programSlug: string,
  cycleStartsOn: string,
): ActiveWorkoutSession | null {
  if (localActive?.programSlug === programSlug && localActive.cycleStartsOn === cycleStartsOn) {
    return localActive;
  }

  return availableSessions.find((session) =>
    session.status === "active"
    && session.programSlug === programSlug
    && session.cycleStartsOn === cycleStartsOn
  ) ?? null;
}
