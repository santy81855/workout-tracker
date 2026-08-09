import programJson from "../../data/programs/hypertrophy-12-week.v1.json";
import { describe, expect, it } from "vitest";
import { programDocumentSchema } from "./schema";

describe("program document", () => {
  const program = programDocumentSchema.parse(programJson);

  it("validates the initial program", () => {
    expect(program.schemaVersion).toBe("1.0");
    expect(program.weekRules).toHaveLength(12);
    expect(program.workoutTemplates).toHaveLength(5);
  });

  it("expands to sixty scheduled workout instances", () => {
    expect(program.weekCount * program.workoutsPerWeek).toBe(60);
  });

  it("contains each prescribed training day in order", () => {
    expect(program.workoutTemplates.map((template) => template.originalDayLabel)).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]);
  });

  it("preserves exercise-specific rep ranges", () => {
    const prescriptions = program.workoutTemplates.flatMap((template) => template.exercises);
    expect(prescriptions.find((item) => item.exercise === "back-squat")).toMatchObject({ repMin: 8, repMax: 12 });
    expect(prescriptions.find((item) => item.exercise === "romanian-deadlift")).toMatchObject({
      repMin: 12,
      repMax: 15,
    });
  });

  it("keeps the week-twelve peak-three second set optional", () => {
    expect(program.weekRules[11].setRules.peak3).toEqual({ required: 1, optional: 1 });
  });

  it("rejects references to exercises outside the catalog", () => {
    const invalid = structuredClone(programJson);
    invalid.workoutTemplates[0].exercises[0].exercise = "not-a-real-exercise";
    expect(programDocumentSchema.safeParse(invalid).success).toBe(false);
  });
});
