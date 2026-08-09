"use client";

import { saveWeeklyCheckin, type WeeklyCheckin } from "@/lib/checkin/weekly-checkin";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const actionOptions = [
  ["increase_reps", "Increase reps where possible"],
  ["increase_eligible_loads", "Increase eligible loads"],
  ["maintain_load", "Maintain current loads"],
  ["reduce_problem_load", "Reduce a problematic load"],
  ["reduce_volume", "Reduce next week's volume"],
] as const;

export function WeeklyCheckinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const week = Math.max(1, Math.min(12, Number(searchParams.get("week")) || 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<WeeklyCheckin>({
    programWeek: week,
    overallRecovery: 3,
    averageSleepHoursTenths: null,
    energy: 3,
    overallSoreness: 3,
    jointDiscomfort: "none",
    jointDiscomfortNotes: "",
    motivation: 3,
    biggestImprovement: "",
    recoveryFactors: "",
    nextWeekActions: [],
    notes: "",
  });

  function rating(field: "overallRecovery" | "energy" | "overallSoreness" | "motivation", value: string) {
    setForm((current) => ({ ...current, [field]: Number(value) }));
  }

  function toggleAction(action: WeeklyCheckin["nextWeekActions"][number]) {
    setForm((current) => ({
      ...current,
      nextWeekActions: current.nextWeekActions.includes(action)
        ? current.nextWeekActions.filter((candidate) => candidate !== action)
        : [...current.nextWeekActions, action],
    }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveWeeklyCheckin(form);
      router.push("/?checkin=saved");
    } catch {
      setError("The weekly review could not be saved. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <form className="checkin-form" onSubmit={submit}>
      <section className="checkin-card">
        <div><p className="eyebrow">Week {week}</p><h2>Recovery snapshot</h2></div>
        <p className="muted-copy">Use 1 for low/poor and 5 for high/excellent. Soreness is reversed: 1 is minimal and 5 is severe.</p>
        <div className="checkin-rating-grid">
          <label>Recovery<select onChange={(event) => rating("overallRecovery", event.target.value)} value={form.overallRecovery}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Energy<select onChange={(event) => rating("energy", event.target.value)} value={form.energy}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Soreness<select onChange={(event) => rating("overallSoreness", event.target.value)} value={form.overallSoreness}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Motivation<select onChange={(event) => rating("motivation", event.target.value)} value={form.motivation}>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label className="checkin-field">Average sleep<input inputMode="decimal" min="0" max="24" placeholder="Hours" step="0.1" type="number" value={form.averageSleepHoursTenths === null ? "" : form.averageSleepHoursTenths / 10} onChange={(event) => setForm((current) => ({ ...current, averageSleepHoursTenths: event.target.value === "" ? null : Math.round(Number(event.target.value) * 10) }))} /></label>
        <label className="checkin-field">Joint discomfort<select value={form.jointDiscomfort} onChange={(event) => setForm((current) => ({ ...current, jointDiscomfort: event.target.value as WeeklyCheckin["jointDiscomfort"] }))}><option value="none">None</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label>
        {form.jointDiscomfort !== "none" ? <label className="checkin-field">Where or what happened?<textarea value={form.jointDiscomfortNotes} onChange={(event) => setForm((current) => ({ ...current, jointDiscomfortNotes: event.target.value }))} /></label> : null}
      </section>

      <section className="checkin-card">
        <div><p className="eyebrow">Reflection</p><h2>What should change?</h2></div>
        <label className="checkin-field">Biggest improvement<textarea value={form.biggestImprovement} onChange={(event) => setForm((current) => ({ ...current, biggestImprovement: event.target.value }))} /></label>
        <label className="checkin-field">Anything affecting recovery?<textarea value={form.recoveryFactors} onChange={(event) => setForm((current) => ({ ...current, recoveryFactors: event.target.value }))} /></label>
        <fieldset className="checkin-actions"><legend>Next-week actions</legend>{actionOptions.map(([value, label]) => <label key={value}><input checked={form.nextWeekActions.includes(value)} onChange={() => toggleAction(value)} type="checkbox" />{label}</label>)}</fieldset>
        <label className="checkin-field">Other notes<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      </section>
      {error ? <p className="form-message action-error" role="alert">{error}</p> : null}
      <button className="primary-button" disabled={saving} type="submit">{saving ? "Saving Review…" : "Save Weekly Review"}</button>
      <button className="text-button checkin-skip" onClick={() => router.push("/")} type="button">Not now</button>
    </form>
  );
}
