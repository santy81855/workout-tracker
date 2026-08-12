import { getActiveProgramRecord } from "@/lib/program/active-program";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workoutRepository } from "./indexeddb-repository";
import { getRemoteSession } from "./history";
import type { ActiveWorkoutSession } from "./types";

interface SyncResult {
  sessionId: string;
  serverRevision: number;
  exercises: number;
  sets: number;
}

export class WorkoutSyncConflictError extends Error {
  constructor(public readonly serverRevision: number | null) {
    super("A newer version of this workout is already stored on the server.");
    this.name = "WorkoutSyncConflictError";
  }
}

function comparableSession(session: ActiveWorkoutSession) {
  const content = structuredClone(session) as Partial<ActiveWorkoutSession>;
  delete content.serverRevision;
  delete content.syncStatus;
  delete content.updatedAt;
  delete content.activeExerciseIndex;
  delete content.restEndsAt;
  delete content.templateColor;
  return content;
}

let activeFlush: Promise<number> | null = null;

function conflictRevision(message: string): number | null {
  const match = message.match(/SYNC_CONFLICT: server revision (\d+)/);
  return match ? Number(match[1]) : null;
}

export async function syncWorkoutSession(session: ActiveWorkoutSession): Promise<SyncResult> {
  const supabase = createSupabaseBrowserClient();
  const activeProgram = await getActiveProgramRecord();
  if (!activeProgram) throw new Error("Select a workout plan before syncing a session.");

  const { error: bootstrapError } = await supabase.rpc("bootstrap_program_cycle", {
    p_document: activeProgram.document,
    p_starts_on: activeProgram.startsOn,
  });

  if (bootstrapError) throw new Error(bootstrapError.message);

  const { data, error } = await supabase.rpc("sync_workout_session", {
    p_session: session,
  });

  if (error) {
    if (error.message.includes("SYNC_CONFLICT")) throw new WorkoutSyncConflictError(conflictRevision(error.message));
    throw new Error(error.message);
  }
  return data as unknown as SyncResult;
}

async function runWorkoutOutboxFlush(): Promise<number> {
  const operations = await workoutRepository.listOutbox();
  let syncedCount = 0;

  for (const operation of operations) {
    try {
      const result = await syncWorkoutSession(operation.payload);
      await workoutRepository.markSessionSynced({
        ...operation.payload,
        serverRevision: result.serverRevision,
        syncStatus: "synced",
      });
      syncedCount += 1;
    } catch (error) {
      if (error instanceof WorkoutSyncConflictError) {
        const remote = await getRemoteSession(operation.sessionId).catch(() => null);
        if (remote && JSON.stringify(comparableSession(remote)) === JSON.stringify(comparableSession(operation.payload))) {
          await workoutRepository.markSessionSynced({ ...operation.payload, serverRevision: remote.serverRevision, syncStatus: "synced" });
          syncedCount += 1;
        } else if (remote && operation.payload.updatedAt > remote.updatedAt) {
          const rebased = { ...operation.payload, serverRevision: remote.serverRevision };
          try {
            const result = await syncWorkoutSession(rebased);
            await workoutRepository.markSessionSynced({ ...rebased, serverRevision: result.serverRevision, syncStatus: "synced" });
            syncedCount += 1;
          } catch { await workoutRepository.markSessionConflict(operation.sessionId, operation.payload.updatedAt); }
        } else await workoutRepository.markSessionConflict(operation.sessionId, operation.payload.updatedAt);
      }
      // The durable operation remains queued for the next foreground attempt.
    }
  }

  return syncedCount;
}

export function flushWorkoutOutbox(): Promise<number> {
  activeFlush ??= runWorkoutOutboxFlush().finally(() => { activeFlush = null; });
  return activeFlush;
}
