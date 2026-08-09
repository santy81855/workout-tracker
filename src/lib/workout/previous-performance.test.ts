import { describe, expect, it } from "vitest";
import { createInitialSession } from "./create-session";
import { applyPreviousLoads, findPreviousExercise } from "./previous-performance";

function completedSession(week: 1 | 12, sequence: number, loadTenthsLb: number) {
  const session = createInitialSession(week, 1, new Date(`2026-0${week === 1 ? 1 : 3}-01T12:00:00Z`));
  session.sequenceInCycle = sequence;
  session.status = "completed";
  session.exercises[0].sets[0] = {
    ...session.exercises[0].sets[0], status: "completed", loadTenthsLb, reps: 20, rirOnTarget: true,
  };
  return session;
}

describe("previous performance", () => {
  it("finds the latest performed exercise across templates", () => {
    const older = completedSession(1, 1, 200);
    const newer = completedSession(1, 2, 225);
    newer.startedAt = "2026-01-02T12:00:00.000Z";
    expect(findPreviousExercise([older, newer], "incline-dumbbell-press")?.exercise.sets[0].loadTenthsLb).toBe(225);
  });

  it("uses the most recent non-deload load and leaves reps at the new prescription", () => {
    const ordinary = completedSession(1, 1, 200);
    const deload = completedSession(12, 56, 150);
    const next = createInitialSession(2, 1, new Date("2026-04-01T12:00:00Z"));
    next.sequenceInCycle = 57;
    const hydrated = applyPreviousLoads(next, [ordinary, deload]);
    expect(hydrated.exercises[0].sets[0].loadTenthsLb).toBe(200);
    expect(hydrated.exercises[0].sets[0].reps).toBe(12);
  });

  it("keeps the first occurrence unset", () => {
    const next = createInitialSession(1, 1);
    expect(applyPreviousLoads(next, []).exercises[0].sets[0].loadTenthsLb).toBeNull();
  });

  it("can reuse a compatible load from an archived cycle regardless of old sequence", () => {
    const archived = completedSession(1, 60, 300);
    archived.programSlug = "archived-plan";
    archived.cycleStartsOn = "2026-01-05";
    const next = createInitialSession(1, 1, new Date("2026-08-10T12:00:00Z"));
    expect(applyPreviousLoads(next, [archived]).exercises[0].sets[0].loadTenthsLb).toBe(300);
  });
});
