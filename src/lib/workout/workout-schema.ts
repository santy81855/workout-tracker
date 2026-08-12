import { z } from "zod";

export const loadBasisValues = [
  "external_total",
  "per_dumbbell",
  "added_bodyweight",
  "bodyweight_only",
  "assistance",
  "repetition_only",
] as const;

export type LoadBasis = (typeof loadBasisValues)[number];

const workoutSetSchema = z.object({
  id: z.string().uuid(),
  setNumber: z.number().int().positive(),
  status: z.enum(["draft", "awaiting_rir", "completed", "skipped"]),
  loadMode: z.enum(loadBasisValues),
  loadTenthsLb: z.number().int().nonnegative().nullable(),
  reps: z.number().int().positive(),
  rirOnTarget: z.boolean().nullable(),
  actualRir: z.union([z.number().int().min(0).max(6), z.literal("6+"), z.literal("unsure")]).nullable(),
  completedAt: z.string().datetime().nullable(),
});

const activeSessionExerciseSchema = z.object({
  id: z.string().uuid(),
  prescribedExerciseSlug: z.string().min(1),
  performedExerciseSlug: z.string().min(1),
  replacementReason: z.enum(["equipment_unavailable", "maintenance", "pain", "preference", "other"]).nullable().default(null),
  name: z.string().min(1),
  repMin: z.number().int().positive(),
  repMax: z.number().int().positive(),
  targetRirLabel: z.string().min(1),
  loadBasis: z.enum(loadBasisValues),
  incrementTenthsLb: z.number().int().positive(),
  restSeconds: z.number().int().min(30).max(600),
  sets: z.array(workoutSetSchema).min(1),
  notes: z.string(),
});

export const activeWorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  status: z.enum(["active", "completed", "partial"]),
  programSlug: z.string().min(1).default("hypertrophy-12-week-v1"),
  cycleStartsOn: z.string().date().default("2026-08-10"),
  sequenceInCycle: z.number().int().positive().default(1),
  programWeek: z.number().int().min(1).max(52),
  templateSequence: z.number().int().min(1).max(7).default(1),
  phase: z.string().min(1),
  templateName: z.string().min(1),
  templateColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563EB"),
  targetRirLabel: z.string().min(1),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable().default(null),
  bodyweightTenthsLb: z.number().int().positive().nullable().default(null),
  energyRating: z.number().int().min(1).max(5).nullable().default(null),
  discomfortLevel: z.enum(["none", "mild", "moderate", "severe"]).nullable().default(null),
  discomfortNotes: z.string().max(2000).default(""),
  sessionNotes: z.string().max(4000).default(""),
  nextTimeAdjustment: z.string().max(2000).default(""),
  updatedAt: z.string().datetime(),
  serverRevision: z.number().int().nonnegative().default(0),
  activeExerciseIndex: z.number().int().nonnegative(),
  exercises: z.array(activeSessionExerciseSchema).min(1),
  restEndsAt: z.string().datetime().nullable(),
  syncStatus: z.enum(["local", "pending", "synced", "conflict"]),
});
