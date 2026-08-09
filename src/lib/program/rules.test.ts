import { describe, expect, it } from "vitest";
import {
  getProgramWeekPrescription,
  getSetPrescription,
  getTargetRir,
  getTrainingPhase,
  isProgramWeek,
} from "./rules";
import type { PeakSets, ProgramWeek } from "./types";

const expectedSets: Record<ProgramWeek, Record<PeakSets, [number, number]>> = {
  1: { 4: [1, 0], 3: [1, 0], 2: [1, 0] },
  2: { 4: [2, 0], 3: [1, 0], 2: [1, 0] },
  3: { 4: [2, 0], 3: [2, 0], 2: [1, 0] },
  4: { 4: [3, 0], 3: [2, 0], 2: [1, 0] },
  5: { 4: [3, 0], 3: [2, 0], 2: [2, 0] },
  6: { 4: [3, 0], 3: [3, 0], 2: [2, 0] },
  7: { 4: [4, 0], 3: [3, 0], 2: [2, 0] },
  8: { 4: [4, 0], 3: [3, 0], 2: [2, 0] },
  9: { 4: [4, 0], 3: [3, 0], 2: [2, 0] },
  10: { 4: [4, 0], 3: [3, 0], 2: [2, 0] },
  11: { 4: [4, 0], 3: [3, 0], 2: [2, 0] },
  12: { 4: [2, 0], 3: [1, 1], 2: [1, 0] },
};

describe("program week rules", () => {
  it("recognizes only integer weeks one through twelve", () => {
    expect(isProgramWeek(1)).toBe(true);
    expect(isProgramWeek(12)).toBe(true);
    expect(isProgramWeek(0)).toBe(false);
    expect(isProgramWeek(13)).toBe(false);
    expect(isProgramWeek(2.5)).toBe(false);
  });

  it.each([
    [1, "Reacclimation"],
    [3, "Reacclimation"],
    [4, "Volume Build"],
    [6, "Volume Build"],
    [7, "Full Volume"],
    [9, "Full Volume"],
    [10, "Peak"],
    [11, "Peak"],
    [12, "Deload"],
  ] as const)("maps week %i to %s", (week, phase) => {
    expect(getTrainingPhase(week)).toBe(phase);
  });

  it("maps every week and peak-set value to the agreed prescription", () => {
    for (const week of Object.keys(expectedSets).map(Number) as ProgramWeek[]) {
      for (const peakSets of [2, 3, 4] as PeakSets[]) {
        const [required, optional] = expectedSets[week][peakSets];
        expect(getSetPrescription(week, peakSets)).toEqual({ required, optional });
      }
    }
  });

  it("treats the second week-12 set for peak-three exercises as optional", () => {
    expect(getSetPrescription(12, 3)).toEqual({ required: 1, optional: 1 });
  });

  it.each([
    [1, 4, 5, "4–5"],
    [5, 2, 3, "2–3"],
    [10, 1, 1, "1"],
    [12, 4, 5, "4–5"],
  ] as const)("maps week %i to target RIR %s", (week, min, max, label) => {
    expect(getTargetRir(week)).toEqual({ min, max, label });
  });

  it("marks only week twelve as a deload", () => {
    expect(getProgramWeekPrescription(11).isDeload).toBe(false);
    expect(getProgramWeekPrescription(12).isDeload).toBe(true);
  });
});
