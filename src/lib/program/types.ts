export const PROGRAM_WEEKS = 12;

export type ProgramWeek = number;
export type PeakSets = 2 | 3 | 4;

export type TrainingPhase = string;

export interface TargetRir {
  min: number;
  max: number;
  label: string;
}

export interface SetPrescription {
  required: number;
  optional: number;
}

export interface ProgramWeekPrescription {
  week: ProgramWeek;
  phase: TrainingPhase;
  targetRir: TargetRir;
  isDeload: boolean;
}
