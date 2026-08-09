import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { z } from "zod";

export const weeklyCheckinSchema = z.object({
  programWeek: z.number().int().min(1).max(12),
  overallRecovery: z.number().int().min(1).max(5),
  averageSleepHoursTenths: z.number().int().min(0).max(240).nullable(),
  energy: z.number().int().min(1).max(5),
  overallSoreness: z.number().int().min(1).max(5),
  jointDiscomfort: z.enum(["none", "mild", "moderate", "severe"]),
  jointDiscomfortNotes: z.string().max(1000),
  motivation: z.number().int().min(1).max(5),
  biggestImprovement: z.string().max(1000),
  recoveryFactors: z.string().max(2000),
  nextWeekActions: z.array(z.enum(["increase_reps", "increase_eligible_loads", "maintain_load", "reduce_problem_load", "reduce_volume"])),
  notes: z.string().max(4000),
});

export type WeeklyCheckin = z.infer<typeof weeklyCheckinSchema>;

export async function saveWeeklyCheckin(checkin: WeeklyCheckin) {
  const payload = weeklyCheckinSchema.parse(checkin);
  const { data, error } = await createSupabaseBrowserClient().rpc("upsert_weekly_checkin", { checkin: payload });
  if (error) throw new Error(error.message);
  return data;
}
