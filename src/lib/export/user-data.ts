import programJson from "@/data/programs/hypertrophy-12-week.v1.json";
import { getActiveProgramRecord } from "@/lib/program/active-program";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { listAvailableSessions } from "@/lib/workout/history";
import type { ActiveWorkoutSession } from "@/lib/workout/types";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function sessionsToCsv(sessions: ActiveWorkoutSession[]) {
  const rows: unknown[][] = [[
    "session_id", "started_at", "finished_at", "status", "program_week", "workout",
    "prescribed_exercise", "performed_exercise", "set_number", "set_status", "load_mode",
    "entered_weight_lb", "reps", "rir_on_target", "actual_rir", "exercise_notes",
    "bodyweight_lb", "energy", "discomfort", "discomfort_notes", "session_notes", "next_time_adjustment",
  ]];
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        rows.push([
          session.id, session.startedAt, session.finishedAt, session.status, session.programWeek, session.templateName,
          exercise.prescribedExerciseSlug, exercise.performedExerciseSlug, set.setNumber, set.status, set.loadMode,
          set.loadTenthsLb === null ? null : set.loadTenthsLb / 10, set.reps, set.rirOnTarget, set.actualRir, exercise.notes,
          session.bodyweightTenthsLb === null ? null : session.bodyweightTenthsLb / 10,
          session.energyRating, session.discomfortLevel, session.discomfortNotes, session.sessionNotes, session.nextTimeAdjustment,
        ]);
      }
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

async function weeklyCheckins() {
  try {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_weekly_checkins");
    if (error) throw error;
    return data ?? [];
  } catch {
    return [];
  }
}

export async function buildCompleteExport() {
  const [sessions, checkins, activeProgram] = await Promise.all([listAvailableSessions(), weeklyCheckins(), getActiveProgramRecord()]);
  return {
    exportSchemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    units: { weight: "lb", weightStorage: "integer tenths of a pound" },
    program: activeProgram.document,
    cycleStartsOn: activeProgram.startsOn,
    workoutSessions: sessions,
    weeklyCheckins: checkins,
  };
}

export function currentProgramTemplate() {
  return programJson;
}

export function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
