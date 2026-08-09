import type { ActiveSessionExercise } from "./types";

export interface ProgressionResult {
  state: "eligible" | "maintain" | "review";
  suggestedLoadTenthsLb: number | null;
  explanation: string;
}

function targetMinimum(label: string) {
  const value = Number.parseInt(label, 10);
  return Number.isFinite(value) ? value : null;
}

export function evaluateProgression(exercise: ActiveSessionExercise, programWeek: number): ProgressionResult {
  if (programWeek === 12) return { state: "maintain", suggestedLoadTenthsLb: null, explanation: "Deload work does not trigger ordinary progression." };
  const sets = exercise.sets.filter((set) => set.status === "completed");
  if (sets.length !== exercise.sets.length) {
    return { state: "maintain", suggestedLoadTenthsLb: null, explanation: "Complete every prescribed set before considering an increase." };
  }
  if (sets.some((set) => set.reps < exercise.repMax)) {
    return { state: "maintain", suggestedLoadTenthsLb: null, explanation: `Build toward ${exercise.repMax} reps across every set at the current load.` };
  }

  const targetMin = targetMinimum(exercise.targetRirLabel);
  let oneRirHarder = 0;
  for (const set of sets) {
    if (set.rirOnTarget) continue;
    if (set.actualRir === "unsure" || set.actualRir === null) {
      return { state: "review", suggestedLoadTenthsLb: null, explanation: "The rep target was reached, but uncertain RIR makes this a judgment call." };
    }
    if (set.actualRir === "6+" || (typeof set.actualRir === "number" && targetMin !== null && set.actualRir >= targetMin)) continue;
    if (typeof set.actualRir === "number" && targetMin !== null && set.actualRir === targetMin - 1) oneRirHarder += 1;
    else return { state: "maintain", suggestedLoadTenthsLb: null, explanation: "At least one set was substantially harder than the prescribed RIR." };
  }
  if (oneRirHarder > 1) {
    return { state: "maintain", suggestedLoadTenthsLb: null, explanation: "More than one set was harder than the lenient RIR allowance." };
  }

  const modes = new Set(sets.map((set) => set.loadMode));
  const loads = new Set(sets.map((set) => set.loadTenthsLb));
  const currentLoad = loads.size === 1 ? sets[0].loadTenthsLb : null;
  const canSuggestLoad = modes.size === 1 && currentLoad !== null;
  return {
    state: "eligible",
    suggestedLoadTenthsLb: canSuggestLoad ? currentLoad + exercise.incrementTenthsLb : null,
    explanation: canSuggestLoad
      ? `Every set reached ${exercise.repMax} reps within the lenient RIR rule.`
      : `Every set reached ${exercise.repMax} reps, but differing or bodyweight loads require a manual choice.`,
  };
}
