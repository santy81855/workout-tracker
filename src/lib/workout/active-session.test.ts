import { describe, expect, it } from "vitest";
import { createInitialSession } from "./create-session";
import { selectCycleActiveSession } from "./active-session";

describe("selectCycleActiveSession", () => {
  it("restores an active workout that exists only in synchronized history", () => {
    const serverActive = createInitialSession();

    expect(selectCycleActiveSession(null, [serverActive], serverActive.programSlug, serverActive.cycleStartsOn))
      .toBe(serverActive);
  });

  it("does not restore an active workout from another cycle", () => {
    const serverActive = createInitialSession();

    expect(selectCycleActiveSession(null, [serverActive], serverActive.programSlug, "2026-08-17"))
      .toBeNull();
  });
});
