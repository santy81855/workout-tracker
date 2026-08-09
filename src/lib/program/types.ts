export const PROGRAM_WEEKS = 12;

export type ProgramWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type PeakSets = 2 | 3 | 4;

export type TrainingPhase =
  | "Reacclimation"
  | "Volume Build"
  | "Full Volume"
  | "Peak"
  | "Deload";

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
