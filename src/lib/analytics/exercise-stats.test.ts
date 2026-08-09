import { describe, expect, it } from "vitest";
import { createInitialSession } from "@/lib/workout/create-session";
import { calculateExerciseStats } from "./exercise-stats";

describe("exercise statistics", () => {
  it("groups exact performed exercises without inferring bodyweight", () => {
    const session = createInitialSession(1, 1);
    session.status = "completed";
    session.exercises[0].sets[0] = { ...session.exercises[0].sets[0], status: "completed", loadTenthsLb: 225, reps: 15, rirOnTarget: true };
    const stat = calculateExerciseStats([session]).find((item) => item.slug === "incline-dumbbell-press");
    expect(stat).toMatchObject({ sessions: 1, completedSets: 1, highestLoadTenthsLb: 225, mostReps: 15, bestSetVolumeTenths: 3375 });
  });
});
