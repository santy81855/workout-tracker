import type { LoadBasis } from "@/lib/workout/workout-schema";

export type SetStatus = "draft" | "awaiting_rir" | "completed" | "skipped";
export type LocalSyncStatus = "local" | "pending" | "synced" | "conflict";

export interface WorkoutSetDraft {
  id: string;
  setNumber: number;
  status: SetStatus;
  loadMode: LoadBasis;
  loadTenthsLb: number | null;
  reps: number;
  rirOnTarget: boolean | null;
  actualRir: number | "6+" | "unsure" | null;
  completedAt: string | null;
}

export interface ActiveSessionExercise {
  id: string;
  prescribedExerciseSlug: string;
  performedExerciseSlug: string;
  replacementReason: "equipment_unavailable" | "maintenance" | "pain" | "preference" | "other" | null;
  name: string;
  repMin: number;
  repMax: number;
  targetRirLabel: string;
  loadBasis: LoadBasis;
  incrementTenthsLb: number;
  restSeconds: number;
  sets: WorkoutSetDraft[];
  notes: string;
}

export interface ActiveWorkoutSession {
  id: string;
  schemaVersion: 1;
  status: "active" | "completed" | "partial";
  programSlug: string;
  cycleStartsOn: string;
  sequenceInCycle: number;
  programWeek: number;
  templateSequence: number;
  phase: string;
  templateName: string;
  templateColor: string;
  targetRirLabel: string;
  startedAt: string;
  finishedAt: string | null;
  bodyweightTenthsLb: number | null;
  energyRating: number | null;
  discomfortLevel: "none" | "mild" | "moderate" | "severe" | null;
  discomfortNotes: string;
  sessionNotes: string;
  nextTimeAdjustment: string;
  updatedAt: string;
  serverRevision: number;
  activeExerciseIndex: number;
  exercises: ActiveSessionExercise[];
  restEndsAt: string | null;
  syncStatus: LocalSyncStatus;
}

export interface WorkoutOutboxOperation {
  id: string;
  sessionId: string;
  mutationType: "upsert_active_session";
  createdAt: string;
  payload: ActiveWorkoutSession;
}
