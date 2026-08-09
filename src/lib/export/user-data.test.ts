import { describe, expect, it } from "vitest";
import { createInitialSession } from "@/lib/workout/create-session";
import { sessionsToCsv } from "./user-data";

describe("portable CSV export", () => {
  it("exports integer-tenths loads as pounds and escapes notes", () => {
    const session = createInitialSession(1, 1, new Date("2026-08-10T12:00:00Z"));
    const exercise = session.exercises[0];
    exercise.notes = "Controlled, deep reps";
    exercise.sets[0] = { ...exercise.sets[0], status: "completed", loadTenthsLb: 125, reps: 12, rirOnTarget: true };
    const csv = sessionsToCsv([session]);
    expect(csv).toContain(",12.5,12,true,");
    expect(csv).toContain('"Controlled, deep reps"');
  });
});
