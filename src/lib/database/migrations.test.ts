import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL("../../../supabase/migrations/20260808150000_initial_schema.sql", import.meta.url);
const migration = readFileSync(migrationUrl, "utf8");

const userOwnedTables = [
  "profiles",
  "user_preferences",
  "exercises",
  "exercise_muscles",
  "exercise_substitutions",
  "programs",
  "program_revisions",
  "program_week_rules",
  "program_set_rules",
  "workout_templates",
  "workout_template_exercises",
  "program_cycles",
  "scheduled_workouts",
  "workout_sessions",
  "session_exercises",
  "exercise_sets",
  "edit_audit_events",
  "weekly_checkins",
  "weekly_muscle_recovery",
  "body_metrics",
] as const;

describe("initial database migration contract", () => {
  it.each(userOwnedTables)("enables RLS on %s", (table) => {
    expect(migration).toContain(`alter table public.${table} enable row level security;`);
  });

  it("does not grant ordinary client delete access", () => {
    expect(migration).not.toMatch(/grant[^;]*delete[^;]*to authenticated/i);
  });

  it("prevents more than one active cycle and session", () => {
    expect(migration).toContain("create unique index one_active_cycle_per_user");
    expect(migration).toContain("create unique index one_active_session_per_user");
  });

  it("makes offline mutation identifiers unique", () => {
    expect(migration).toContain("client_mutation_id uuid not null");
    expect(migration).toContain("unique (client_mutation_id)");
  });

  it("protects published program revisions from mutation", () => {
    expect(migration).toContain("prevent_published_program_revision_change");
    expect(migration).toContain("Published program revisions are immutable");
  });

  it("stores historical exercise prescriptions as snapshots", () => {
    for (const column of [
      "exercise_name_snapshot",
      "load_basis_snapshot",
      "rep_min_snapshot",
      "rep_max_snapshot",
      "prescribed_sets_snapshot",
      "target_rir_min_snapshot",
      "target_rir_max_snapshot",
    ]) {
      expect(migration).toContain(column);
    }
  });
});
