import type { ProgramDocument } from "./schema";
import type { ProgramWeek } from "./types";

export type ScheduledWorkoutState = "queued" | "active" | "completed" | "partial" | "skipped";

export interface ScheduledWorkoutDraft {
  sequenceInCycle: number;
  programWeek: ProgramWeek;
  templateSequence: number;
  templateName: string;
  originalScheduledDate: string;
  currentScheduledDate: string;
  rolloverCount: number;
  status: ScheduledWorkoutState;
}

const RESOLVED_STATES = new Set<ScheduledWorkoutState>(["completed", "partial", "skipped"]);

function parseLocalDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid local date: ${value}`);
  }
  return date;
}

function formatLocalDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addLocalDays(value: string, days: number): string {
  const date = parseLocalDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatLocalDate(date);
}

export function differenceInLocalDays(later: string, earlier: string): number {
  const milliseconds = parseLocalDate(later).valueOf() - parseLocalDate(earlier).valueOf();
  return Math.round(milliseconds / 86_400_000);
}

export function generateScheduledWorkouts(
  program: ProgramDocument,
  cycleStartDate: string,
): ScheduledWorkoutDraft[] {
  parseLocalDate(cycleStartDate);

  return Array.from({ length: program.weekCount * program.workoutsPerWeek }, (_, index) => {
      const sequenceInCycle = index + 1;
      const weekIndex = Math.floor(index / program.workoutsPerWeek);
      const template = program.workoutTemplates[index % program.workoutTemplates.length];
      const scheduledDate = addLocalDays(cycleStartDate, weekIndex * 7 + (index % program.workoutsPerWeek));

      return {
        sequenceInCycle,
        programWeek: (weekIndex + 1) as ProgramWeek,
        templateSequence: template.sequence,
        templateName: template.name,
        originalScheduledDate: scheduledDate,
        currentScheduledDate: scheduledDate,
        rolloverCount: 0,
        status: "queued" as const,
      };
    });
}

export function rollUnresolvedWorkoutsForward<T extends ScheduledWorkoutDraft>(
  workouts: readonly T[],
  today: string,
): T[] {
  parseLocalDate(today);
  const firstUnresolved = workouts.find((workout) => !RESOLVED_STATES.has(workout.status));

  if (!firstUnresolved || firstUnresolved.currentScheduledDate >= today) {
    return workouts.map((workout) => ({ ...workout }));
  }

  const displacement = differenceInLocalDays(today, firstUnresolved.currentScheduledDate);

  return workouts.map((workout) => {
    if (RESOLVED_STATES.has(workout.status)) return { ...workout };

    return {
      ...workout,
      currentScheduledDate: addLocalDays(workout.currentScheduledDate, displacement),
      rolloverCount: workout.rolloverCount + displacement,
    };
  });
}

export function isProgramWeekResolved(
  workouts: readonly Pick<ScheduledWorkoutDraft, "programWeek" | "status">[],
  week: ProgramWeek,
): boolean {
  const weekWorkouts = workouts.filter((workout) => workout.programWeek === week);
  return weekWorkouts.length > 0 && weekWorkouts.every((workout) => RESOLVED_STATES.has(workout.status));
}

export function getCurrentProgramWeek(
  workouts: readonly Pick<ScheduledWorkoutDraft, "programWeek" | "status">[],
): ProgramWeek {
  const unresolved = workouts.find((workout) => !RESOLVED_STATES.has(workout.status));
  return unresolved?.programWeek ?? Math.max(...workouts.map((workout) => workout.programWeek), 1);
}
