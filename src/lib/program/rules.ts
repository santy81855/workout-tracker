import type {
  PeakSets,
  ProgramWeek,
  ProgramWeekPrescription,
  SetPrescription,
  TargetRir,
  TrainingPhase,
} from "./types";

const SET_RULES: Record<ProgramWeek, Record<PeakSets, SetPrescription>> = {
  1: { 4: { required: 1, optional: 0 }, 3: { required: 1, optional: 0 }, 2: { required: 1, optional: 0 } },
  2: { 4: { required: 2, optional: 0 }, 3: { required: 1, optional: 0 }, 2: { required: 1, optional: 0 } },
  3: { 4: { required: 2, optional: 0 }, 3: { required: 2, optional: 0 }, 2: { required: 1, optional: 0 } },
  4: { 4: { required: 3, optional: 0 }, 3: { required: 2, optional: 0 }, 2: { required: 1, optional: 0 } },
  5: { 4: { required: 3, optional: 0 }, 3: { required: 2, optional: 0 }, 2: { required: 2, optional: 0 } },
  6: { 4: { required: 3, optional: 0 }, 3: { required: 3, optional: 0 }, 2: { required: 2, optional: 0 } },
  7: { 4: { required: 4, optional: 0 }, 3: { required: 3, optional: 0 }, 2: { required: 2, optional: 0 } },
  8: { 4: { required: 4, optional: 0 }, 3: { required: 3, optional: 0 }, 2: { required: 2, optional: 0 } },
  9: { 4: { required: 4, optional: 0 }, 3: { required: 3, optional: 0 }, 2: { required: 2, optional: 0 } },
  10: { 4: { required: 4, optional: 0 }, 3: { required: 3, optional: 0 }, 2: { required: 2, optional: 0 } },
  11: { 4: { required: 4, optional: 0 }, 3: { required: 3, optional: 0 }, 2: { required: 2, optional: 0 } },
  12: { 4: { required: 2, optional: 0 }, 3: { required: 1, optional: 1 }, 2: { required: 1, optional: 0 } },
};

const TARGET_RIR: Record<ProgramWeek, TargetRir> = {
  1: { min: 4, max: 5, label: "4–5" },
  2: { min: 4, max: 4, label: "4" },
  3: { min: 3, max: 4, label: "3–4" },
  4: { min: 3, max: 3, label: "3" },
  5: { min: 2, max: 3, label: "2–3" },
  6: { min: 2, max: 2, label: "2" },
  7: { min: 2, max: 2, label: "2" },
  8: { min: 1, max: 2, label: "1–2" },
  9: { min: 1, max: 2, label: "1–2" },
  10: { min: 1, max: 1, label: "1" },
  11: { min: 1, max: 1, label: "1" },
  12: { min: 4, max: 5, label: "4–5" },
};

export function isProgramWeek(value: number): value is ProgramWeek {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

export function getTrainingPhase(week: ProgramWeek): TrainingPhase {
  if (week <= 3) return "Reacclimation";
  if (week <= 6) return "Volume Build";
  if (week <= 9) return "Full Volume";
  if (week <= 11) return "Peak";
  return "Deload";
}

export function getTargetRir(week: ProgramWeek): TargetRir {
  return { ...TARGET_RIR[week] };
}

export function getSetPrescription(week: ProgramWeek, peakSets: PeakSets): SetPrescription {
  return { ...SET_RULES[week][peakSets] };
}

export function getProgramWeekPrescription(week: ProgramWeek): ProgramWeekPrescription {
  return {
    week,
    phase: getTrainingPhase(week),
    targetRir: getTargetRir(week),
    isDeload: week === 12,
  };
}
