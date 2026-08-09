import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { activeWorkoutSessionSchema } from "./workout-schema";
import type { ActiveWorkoutSession, WorkoutOutboxOperation } from "./types";
import type { WorkoutRepository } from "./repository";

interface WorkoutDatabase extends DBSchema {
  sessions: {
    key: string;
    value: ActiveWorkoutSession;
    indexes: { status: ActiveWorkoutSession["status"] };
  };
  outbox: {
    key: string;
    value: WorkoutOutboxOperation;
    indexes: { sessionId: string };
  };
}

let databasePromise: Promise<IDBPDatabase<WorkoutDatabase>> | null = null;

function database() {
  databasePromise ??= openDB<WorkoutDatabase>("workout-tracker", 1, {
    upgrade(db) {
      const sessions = db.createObjectStore("sessions", { keyPath: "id" });
      sessions.createIndex("status", "status");
      const outbox = db.createObjectStore("outbox", { keyPath: "id" });
      outbox.createIndex("sessionId", "sessionId");
    },
  });
  return databasePromise;
}

export class IndexedDbWorkoutRepository implements WorkoutRepository {
  async getActiveSession(): Promise<ActiveWorkoutSession | null> {
    const stored = await (await database()).getFromIndex("sessions", "status", "active");
    if (!stored) return null;
    const parsed = activeWorkoutSessionSchema.safeParse(stored);
    if (!parsed.success) throw new Error("The locally saved workout is not readable by this application version.");
    return parsed.data;
  }

  async getSession(sessionId: string): Promise<ActiveWorkoutSession | null> {
    const stored = await (await database()).get("sessions", sessionId);
    if (!stored) return null;
    const parsed = activeWorkoutSessionSchema.safeParse(stored);
    if (!parsed.success) throw new Error("The locally saved workout is not readable by this application version.");
    return parsed.data;
  }

  async listSessions(): Promise<ActiveWorkoutSession[]> {
    const stored = await (await database()).getAll("sessions");
    return stored
      .map((session) => activeWorkoutSessionSchema.safeParse(session))
      .filter((result) => result.success)
      .map((result) => result.data)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }

  async listOutbox(): Promise<WorkoutOutboxOperation[]> {
    return (await (await database()).getAll("outbox")).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async saveActiveSession(session: ActiveWorkoutSession): Promise<void> {
    const validated = activeWorkoutSessionSchema.parse(session);
    const db = await database();
    const transaction = db.transaction(["sessions", "outbox"], "readwrite");
    await transaction.objectStore("sessions").put(validated);
    await transaction.objectStore("outbox").put({
      id: `session:${validated.id}`,
      sessionId: validated.id,
      mutationType: "upsert_active_session",
      createdAt: new Date().toISOString(),
      payload: validated,
    });
    await transaction.done;
  }

  async markSessionSynced(session: ActiveWorkoutSession): Promise<void> {
    const validated = activeWorkoutSessionSchema.parse(session);
    const db = await database();
    const transaction = db.transaction(["sessions", "outbox"], "readwrite");
    const sessionStore = transaction.objectStore("sessions");
    const current = await sessionStore.get(validated.id);
    if (current?.updatedAt === validated.updatedAt) {
      await sessionStore.put(validated);
      await transaction.objectStore("outbox").delete(`session:${validated.id}`);
    }
    await transaction.done;
  }

  async markSessionConflict(sessionId: string, expectedUpdatedAt: string): Promise<void> {
    const db = await database();
    const transaction = db.transaction(["sessions"], "readwrite");
    const store = transaction.objectStore("sessions");
    const current = await store.get(sessionId);
    if (current?.updatedAt === expectedUpdatedAt) await store.put({ ...current, syncStatus: "conflict" });
    await transaction.done;
  }

  async acceptRemoteSession(session: ActiveWorkoutSession): Promise<void> {
    const validated = activeWorkoutSessionSchema.parse({ ...session, syncStatus: "synced" });
    const db = await database();
    const transaction = db.transaction(["sessions", "outbox"], "readwrite");
    await transaction.objectStore("sessions").put(validated);
    await transaction.objectStore("outbox").delete(`session:${validated.id}`);
    await transaction.done;
  }

  async clearActiveSession(): Promise<void> {
    const active = await this.getActiveSession();
    if (!active) return;
    const db = await database();
    const transaction = db.transaction(["sessions", "outbox"], "readwrite");
    await transaction.objectStore("sessions").delete(active.id);
    await transaction.objectStore("outbox").delete(`session:${active.id}`);
    await transaction.done;
  }

  async clearAllData(): Promise<void> {
    const db = await database();
    const transaction = db.transaction(["sessions", "outbox"], "readwrite");
    await transaction.objectStore("sessions").clear();
    await transaction.objectStore("outbox").clear();
    await transaction.done;
  }
}

export const workoutRepository: WorkoutRepository = new IndexedDbWorkoutRepository();
