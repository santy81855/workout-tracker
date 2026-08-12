import programJson from "../../data/programs/hypertrophy-12-week.v1.json";
import { describe, expect, it } from "vitest";
import { programDocumentSchema } from "./schema";
import {
  addLocalDays,
  generateScheduledWorkouts,
  getCurrentProgramWeek,
  isProgramWeekResolved,
  rollUnresolvedWorkoutsForward,
} from "./schedule";

const program = programDocumentSchema.parse(programJson);

describe("program scheduling", () => {
  it("generates sixty ordered workout instances from the agreed start date", () => {
    const workouts = generateScheduledWorkouts(program, "2026-08-10");

    expect(workouts).toHaveLength(60);
    expect(workouts[0]).toMatchObject({
      sequenceInCycle: 1,
      programWeek: 1,
      templateSequence: 1,
      originalScheduledDate: "2026-08-10",
    });
    expect(workouts[4]).toMatchObject({
      sequenceInCycle: 5,
      programWeek: 1,
      templateSequence: 5,
      originalScheduledDate: "2026-08-14",
    });
    expect(workouts[5]).toMatchObject({
      sequenceInCycle: 6,
      programWeek: 2,
      originalScheduledDate: "2026-08-17",
    });
    expect(workouts[59]).toMatchObject({
      sequenceInCycle: 60,
      programWeek: 12,
      originalScheduledDate: "2026-10-30",
    });
  });

  it("rolls a missed workout and every later unresolved workout forward", () => {
    const workouts = generateScheduledWorkouts(program, "2026-08-10");
    const rolled = rollUnresolvedWorkoutsForward(workouts, "2026-08-11");

    expect(rolled[0].currentScheduledDate).toBe("2026-08-11");
    expect(rolled[4].currentScheduledDate).toBe("2026-08-15");
    expect(rolled[0].programWeek).toBe(1);
    expect(rolled[0].originalScheduledDate).toBe("2026-08-10");
    expect(rolled[0].rolloverCount).toBe(1);
  });

  it("rotates six templates through a five-workout weekly cadence", () => {
    const rollingDocument = structuredClone(programJson);
    rollingDocument.workoutTemplates.push({ ...structuredClone(rollingDocument.workoutTemplates[0]), sequence: 6, originalDayLabel: "Rolling 6", name: "Legs B" });
    const rolling = programDocumentSchema.parse(rollingDocument);
    const workouts = generateScheduledWorkouts(rolling, "2026-08-10");
    expect(workouts).toHaveLength(60);
    expect(workouts.slice(0, 8).map((workout) => workout.templateSequence)).toEqual([1, 2, 3, 4, 5, 6, 1, 2]);
    expect(workouts[5]).toMatchObject({ programWeek: 2, originalScheduledDate: "2026-08-17" });
  });

  it("allows rollover onto both weekend days", () => {
    const workouts = generateScheduledWorkouts(program, "2026-08-10");

    const saturdayRoll = rollUnresolvedWorkoutsForward(workouts, "2026-08-11");
    expect(saturdayRoll[4].currentScheduledDate).toBe("2026-08-15");

    const sundayRoll = rollUnresolvedWorkoutsForward(workouts, "2026-08-12");
    expect(sundayRoll[4].currentScheduledDate).toBe("2026-08-16");
  });

  it("does not move already resolved workouts", () => {
    const workouts = generateScheduledWorkouts(program, "2026-08-10");
    workouts[0].status = "completed";
    const rolled = rollUnresolvedWorkoutsForward(workouts, "2026-08-12");

    expect(rolled[0].currentScheduledDate).toBe("2026-08-10");
    expect(rolled[1].currentScheduledDate).toBe("2026-08-12");
  });

  it("advances the program week only after all five workouts resolve", () => {
    const workouts = generateScheduledWorkouts(program, "2026-08-10");
    for (const workout of workouts.slice(0, 4)) workout.status = "completed";

    expect(isProgramWeekResolved(workouts, 1)).toBe(false);
    expect(getCurrentProgramWeek(workouts)).toBe(1);

    workouts[4].status = "skipped";
    expect(isProgramWeekResolved(workouts, 1)).toBe(true);
    expect(getCurrentProgramWeek(workouts)).toBe(2);
  });

  it("handles leap days without local timezone drift", () => {
    expect(addLocalDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addLocalDays("2028-02-29", 1)).toBe("2028-03-01");
  });

  it("rejects impossible local dates", () => {
    expect(() => addLocalDays("2026-02-30", 1)).toThrow("Invalid local date");
  });
});
