import programJson from "../../data/programs/hypertrophy-12-week.v1.json";
import { describe, expect, it } from "vitest";
import { programDocumentSchema } from "./schema";

describe("program document", () => {
  const program = programDocumentSchema.parse(programJson);

  it("validates the initial program", () => {
    expect(program.schemaVersion).toBe("1.0");
    expect(program.weekRules).toHaveLength(12);
    expect(program.workoutTemplates).toHaveLength(5);
    expect(program.workoutTemplates.every((template) => /^#[0-9A-F]{6}$/i.test(template.color))).toBe(true);
  });

  it("adds stable workout colors to older documents", () => {
    const legacy = structuredClone(programJson) as unknown as Record<string, unknown>;
    const templates = legacy.workoutTemplates as Array<Record<string, unknown>>;
    for (const template of templates) delete template.color;
    expect(programDocumentSchema.parse(legacy).workoutTemplates.map((template) => template.color)).toEqual([
      "#00B8F0", "#FF9F0A", "#64D23D", "#A855F7", "#FF3B7D",
    ]);
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

  it("accepts valid programs with different week and workout counts", () => {
    const flexible = structuredClone(programJson);
    flexible.slug = "eight-week-six-day-plan";
    flexible.weekCount = 8;
    flexible.weekRules = flexible.weekRules.slice(0, 8);
    flexible.workoutsPerWeek = 6;
    flexible.workoutTemplates.push({ ...structuredClone(flexible.workoutTemplates[0]), sequence: 6, originalDayLabel: "Saturday", name: "Sixth Day" });
    expect(programDocumentSchema.safeParse(flexible).success).toBe(true);
  });

  it("accepts a rolling template rotation larger than weekly training frequency", () => {
    const rolling = structuredClone(programJson);
    rolling.slug = "rolling-six-template-plan";
    rolling.workoutTemplates.push({ ...structuredClone(rolling.workoutTemplates[0]), sequence: 6, originalDayLabel: "Rolling Session 6", name: "Legs B" });
    expect(rolling.workoutsPerWeek).toBe(5);
    expect(programDocumentSchema.safeParse(rolling).success).toBe(true);
  });

  it("normalizes an unused legacy peak-set bucket without changing used prescriptions", () => {
    const rolling = structuredClone(programJson);
    for (const template of rolling.workoutTemplates) for (const exercise of template.exercises) exercise.peakSets = exercise.peakSets === 2 ? 3 : exercise.peakSets;
    for (const week of rolling.weekRules) week.setRules.peak2.required = 3;
    const parsed = programDocumentSchema.parse(rolling);
    expect(parsed.weekRules[0].setRules.peak2.required).toBe(2);
    expect(parsed.weekRules[0].setRules.peak3).toEqual(rolling.weekRules[0].setRules.peak3);
  });
});
