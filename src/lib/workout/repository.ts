import type { ActiveWorkoutSession, WorkoutOutboxOperation } from "./types";

export interface WorkoutRepository {
  getActiveSession(): Promise<ActiveWorkoutSession | null>;
  getSession(sessionId: string): Promise<ActiveWorkoutSession | null>;
  listSessions(): Promise<ActiveWorkoutSession[]>;
  listOutbox(): Promise<WorkoutOutboxOperation[]>;
  saveActiveSession(session: ActiveWorkoutSession): Promise<void>;
  markSessionSynced(session: ActiveWorkoutSession): Promise<void>;
  markSessionConflict(sessionId: string, expectedUpdatedAt: string): Promise<void>;
  acceptRemoteSession(session: ActiveWorkoutSession): Promise<void>;
  clearActiveSession(): Promise<void>;
  clearAllData(): Promise<void>;
}
