import { describe, expect, it } from "vitest";
import { createInitialSession } from "./create-session";
import { canSafelyRebaseWorkout } from "./sync";

describe("workout conflict rebasing", () => {
  it("allows a completed device workout to advance its active server version despite server clock ordering", () => {
    const local = { ...createInitialSession(), status: "completed" as const, finishedAt: "2026-08-12T12:30:00.000Z", updatedAt: "2026-08-12T12:30:00.000Z" };
    const remote = { ...local, status: "active" as const, finishedAt: null, updatedAt: "2026-08-12T12:30:00.100Z" };
    expect(canSafelyRebaseWorkout(local, remote)).toBe(true);
  });

  it("does not overwrite a newer completed server workout", () => {
    const local = { ...createInitialSession(), status: "completed" as const, finishedAt: "2026-08-12T12:30:00.000Z", updatedAt: "2026-08-12T12:30:00.000Z" };
    const remote = { ...local, updatedAt: "2026-08-12T12:31:00.000Z" };
    expect(canSafelyRebaseWorkout(local, remote)).toBe(false);
  });
});
