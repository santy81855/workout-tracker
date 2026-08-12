import { defaultProgram } from "@/lib/program/active-program";
import type { ProgramDocument } from "@/lib/program/schema";
import type { ProgramWeek } from "@/lib/program/types";
import type { ActiveWorkoutSession } from "./types";

function formatRir(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

export function createInitialSession(
  programWeek: ProgramWeek = 1,
  templateSequence = 1,
  now = new Date(),
  program: ProgramDocument = defaultProgram,
  cycleStartsOn = "2026-08-10",
  sequenceInCycle = (programWeek - 1) * program.workoutsPerWeek + templateSequence,
): ActiveWorkoutSession {
  const template = program.workoutTemplates.find((candidate) => candidate.sequence === templateSequence);
  if (!template) throw new Error(`Unknown workout template sequence ${templateSequence}`);

  const weekRule = program.weekRules.find((candidate) => candidate.week === programWeek);
  if (!weekRule) throw new Error(`Missing program week ${programWeek}`);

  const exerciseCatalog = new Map(program.exercises.map((exercise) => [exercise.slug, exercise]));
  const timestamp = now.toISOString();

  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    status: "active",
    programSlug: program.slug,
    cycleStartsOn,
    sequenceInCycle,
    programWeek,
    templateSequence,
    phase: weekRule.phase,
    templateName: template.name,
    templateColor: template.color,
    targetRirLabel: formatRir(weekRule.targetRir.min, weekRule.targetRir.max),
    startedAt: timestamp,
    finishedAt: null,
    bodyweightTenthsLb: null,
    energyRating: null,
    discomfortLevel: null,
    discomfortNotes: "",
    sessionNotes: "",
    nextTimeAdjustment: "",
    updatedAt: timestamp,
    serverRevision: 0,
    activeExerciseIndex: 0,
    restEndsAt: null,
    syncStatus: "local",
    exercises: template.exercises.map((prescribed) => {
      const exercise = exerciseCatalog.get(prescribed.exercise);
      if (!exercise) throw new Error(`Unknown exercise ${prescribed.exercise}`);
      const setRule = weekRule.setRules[`peak${prescribed.peakSets}` as "peak2" | "peak3" | "peak4"];
      const sets = { required: setRule.required, optional: setRule.optional };

      return {
        id: crypto.randomUUID(),
        prescribedExerciseSlug: exercise.slug,
        performedExerciseSlug: exercise.slug,
        replacementReason: null,
        name: exercise.name,
        repMin: prescribed.repMin,
        repMax: prescribed.repMax,
        targetRirLabel: formatRir(weekRule.targetRir.min, weekRule.targetRir.max),
        loadBasis: exercise.loadBasis,
        incrementTenthsLb: prescribed.incrementTenthsLb ?? exercise.defaultIncrementTenthsLb,
        restSeconds: prescribed.restSeconds ?? exercise.defaultRestSeconds,
        notes: "",
        sets: Array.from({ length: sets.required }, (_, setIndex) => ({
          id: crypto.randomUUID(),
          setNumber: setIndex + 1,
          status: "draft" as const,
          loadMode: exercise.loadBasis,
          loadTenthsLb: null,
          reps: prescribed.repMin,
          rirOnTarget: null,
          actualRir: null,
          completedAt: null,
        })),
      };
    }),
  };
}
