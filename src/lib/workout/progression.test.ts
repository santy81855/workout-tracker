import { describe, expect, it } from "vitest";
import { createInitialSession } from "./create-session";
import { evaluateProgression } from "./progression";

function qualifiedExercise() {
  const exercise = createInitialSession(7, 1).exercises[0];
  exercise.sets = exercise.sets.map((set) => ({ ...set, status: "completed", loadTenthsLb: 500, reps: 20, rirOnTarget: true }));
  return exercise;
}

describe("progression eligibility", () => {
  it("suggests one configured increment after all sets qualify", () => {
    expect(evaluateProgression(qualifiedExercise(), 7)).toMatchObject({ state: "eligible", suggestedLoadTenthsLb: 525 });
  });

  it("allows one set one RIR harder", () => {
    const exercise = qualifiedExercise();
    exercise.sets[0] = { ...exercise.sets[0], rirOnTarget: false, actualRir: 1 };
    expect(evaluateProgression(exercise, 7).state).toBe("eligible");
  });

  it("rejects one strong set and substantially harder RIR", () => {
    const exercise = qualifiedExercise();
    exercise.sets[1].reps = 19;
    expect(evaluateProgression(exercise, 7).state).toBe("maintain");
    exercise.sets[1].reps = 20;
    exercise.sets[0] = { ...exercise.sets[0], rirOnTarget: false, actualRir: 0 };
    expect(evaluateProgression(exercise, 7).state).toBe("maintain");
  });

  it("excludes deload sessions", () => {
    expect(evaluateProgression(qualifiedExercise(), 12).state).toBe("maintain");
  });
});
