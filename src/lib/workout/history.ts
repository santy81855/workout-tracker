import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workoutRepository } from "./indexeddb-repository";
import { activeWorkoutSessionSchema } from "./workout-schema";
import type { ActiveWorkoutSession } from "./types";

export async function listRemoteSessions(): Promise<ActiveWorkoutSession[]> {
  const supabase = createSupabaseBrowserClient();
  const [{ data, error }, { data: library }] = await Promise.all([supabase.rpc("get_workout_history"), supabase.rpc("get_program_library")]);
  if (error) throw new Error(error.message);
  const sessions = activeWorkoutSessionSchema.array().parse(data);
  const cycles = (library as Array<{ startsOn: string; document: { slug: string; workoutsPerWeek: number } }> | null) ?? [];
  return sessions.map((session) => {
    const cycle = cycles.find((candidate) => candidate.startsOn === session.cycleStartsOn && candidate.document.slug === session.programSlug);
    const workoutsPerWeek = cycle?.document.workoutsPerWeek ?? 5;
    return { ...session, templateSequence: ((session.sequenceInCycle - 1) % workoutsPerWeek) + 1 };
  });
}

export async function listAvailableSessions(): Promise<ActiveWorkoutSession[]> {
  const localSessions = await workoutRepository.listSessions();
  let remoteSessions: ActiveWorkoutSession[] = [];

  try {
    remoteSessions = await listRemoteSessions();
  } catch {
    // Offline and unauthenticated callers continue with durable device-local data.
  }

  const sessions = new Map<string, ActiveWorkoutSession>();
  for (const remote of remoteSessions) sessions.set(remote.id, remote);
  for (const local of localSessions) {
    const remote = sessions.get(local.id);
    if (!remote || local.updatedAt >= remote.updatedAt) sessions.set(local.id, local);
  }

  return [...sessions.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

export async function getAvailableSession(sessionId: string): Promise<ActiveWorkoutSession | null> {
  const local = await workoutRepository.getSession(sessionId);
  if (local) return local;
  const sessions = await listAvailableSessions();
  return sessions.find((session) => session.id === sessionId) ?? null;
}

export async function getRemoteSession(sessionId: string): Promise<ActiveWorkoutSession | null> {
  const sessions = await listRemoteSessions();
  return sessions.find((session) => session.id === sessionId) ?? null;
}
