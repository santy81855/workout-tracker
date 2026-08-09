import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workoutRepository } from "./indexeddb-repository";
import { activeWorkoutSessionSchema } from "./workout-schema";
import type { ActiveWorkoutSession } from "./types";

export async function listRemoteSessions(): Promise<ActiveWorkoutSession[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("get_workout_history");
  if (error) throw new Error(error.message);
  return activeWorkoutSessionSchema.array().parse(data);
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
