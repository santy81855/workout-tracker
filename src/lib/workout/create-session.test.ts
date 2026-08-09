import { describe, expect, it } from "vitest";
import { createInitialSession } from "./create-session";
import { activeWorkoutSessionSchema } from "./workout-schema";

describe("active workout snapshot creation", () => {
  it("creates the first workout with immutable week-one prescriptions", () => {
    const session = createInitialSession(1, 1, new Date("2026-08-10T12:00:00.000Z"));

    expect(activeWorkoutSessionSchema.safeParse(session).success).toBe(true);
    expect(session.templateName).toBe("Chest + Quads + Biceps");
    expect(session.phase).toBe("Reacclimation");
    expect(session.targetRirLabel).toBe("4–5");
    expect(session.exercises).toHaveLength(6);
    expect(session.exercises.every((exercise) => exercise.sets.length === 1)).toBe(true);
  });

  it("leaves first-occurrence load unset and starts reps at the lower target", () => {
    const session = createInitialSession();
    const firstSet = session.exercises[0].sets[0];

    expect(firstSet.loadTenthsLb).toBeNull();
    expect(firstSet.reps).toBe(12);
    expect(firstSet.status).toBe("draft");
  });

  it("uses exercise-specific increments and load semantics", () => {
    const monday = createInitialSession(1, 1);
    expect(monday.exercises[0]).toMatchObject({ loadBasis: "per_dumbbell", incrementTenthsLb: 25 });
    expect(monday.exercises[3]).toMatchObject({ loadBasis: "external_total", incrementTenthsLb: 100 });

    const tuesday = createInitialSession(1, 2);
    expect(tuesday.exercises[0]).toMatchObject({ loadBasis: "added_bodyweight" });
  });

  it("expands later weeks to their prescribed set counts", () => {
    const fullVolume = createInitialSession(7, 1);
    expect(fullVolume.exercises.map((exercise) => exercise.sets.length)).toEqual([4, 3, 2, 4, 3, 3]);
  });
});
