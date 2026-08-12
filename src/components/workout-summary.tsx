"use client";

import { getAvailableSession } from "@/lib/workout/history";
import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { evaluateProgression } from "@/lib/workout/progression";
import { flushWorkoutOutbox } from "@/lib/workout/sync";
import type { ActiveWorkoutSession } from "@/lib/workout/types";
import Link from "next/link";
import { BottomNavigation } from "@/components/bottom-navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useActiveProgram } from "@/lib/program/use-active-program";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function localDateValue(timestamp: string) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.valueOf() - offset).toISOString().slice(0, 10);
}

export function WorkoutSummary() {
  const { document: program } = useActiveProgram();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [draft, setDraft] = useState<ActiveWorkoutSession | null>(null);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [performedDate, setPerformedDate] = useState("");
  const sessionId = searchParams.get("session");

  useEffect(() => {
    void flushWorkoutOutbox();
    if (sessionId) void getAvailableSession(sessionId).then(setSession);
  }, [sessionId]);

  function beginEditing() {
    if (!session) return;
    setDraft(structuredClone(session));
    setPerformedDate(localDateValue(session.startedAt));
    setEditing(true);
    setMessage(null);
  }

  function updateSet(exerciseIndex: number, setIndex: number, field: "loadTenthsLb" | "reps", value: string) {
    if (!draft) return;
    const exercises = structuredClone(draft.exercises);
    const set = exercises[exerciseIndex].sets[setIndex];
    if (field === "loadTenthsLb") set.loadTenthsLb = value === "" ? null : Math.max(0, Math.round(Number(value) * 10));
    else set.reps = Math.max(0, Math.round(Number(value)));
    setDraft({ ...draft, exercises });
  }

  function updateNotes(exerciseIndex: number, notes: string) {
    if (!draft) return;
    const exercises = structuredClone(draft.exercises);
    exercises[exerciseIndex].notes = notes;
    setDraft({ ...draft, exercises });
  }

  function updateSessionFields(change: Partial<Pick<ActiveWorkoutSession, "bodyweightTenthsLb" | "energyRating" | "discomfortLevel" | "discomfortNotes" | "sessionNotes" | "nextTimeAdjustment">>) {
    setDraft((current) => current ? { ...current, ...change } : current);
  }

  function withPerformedDate(value: ActiveWorkoutSession, dateValue: string) {
    const originalStart = new Date(value.startedAt);
    const [year, month, day] = dateValue.split("-").map(Number);
    const nextStart = new Date(originalStart);
    nextStart.setFullYear(year, month - 1, day);
    const duration = value.finishedAt ? new Date(value.finishedAt).valueOf() - originalStart.valueOf() : null;
    return { ...value, startedAt: nextStart.toISOString(), finishedAt: duration === null ? null : new Date(nextStart.valueOf() + duration).toISOString() };
  }

  async function saveUpdates() {
    if (!draft) return;
    try {
      if (!performedDate) throw new Error("Choose a valid workout date.");
      let updatedDraft = draft;
      if (performedDate && performedDate !== localDateValue(session?.startedAt ?? draft.startedAt)) {
        const { data, error } = await createSupabaseBrowserClient().rpc("correct_workout_performed_date", { p_session_id: draft.id, p_performed_date: performedDate });
        if (error && !error.message.toLowerCase().includes("completed workout not found")) throw new Error(error.message);
        if (error) updatedDraft = withPerformedDate(draft, performedDate);
        else {
          const correction = data as { serverRevision: number; startedAt: string; finishedAt: string | null };
          updatedDraft = { ...draft, startedAt: correction.startedAt, finishedAt: correction.finishedAt, serverRevision: correction.serverRevision };
        }
      }
      const updated = { ...updatedDraft, updatedAt: new Date().toISOString(), syncStatus: "pending" as const };
      await workoutRepository.saveActiveSession(updated);
      setSession(updated);
      setDraft(null);
      setEditing(false);
      setMessage("Workout updates saved on this device and queued to sync.");
      void flushWorkoutOutbox();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The workout could not be updated. Review the values and try again.");
    }
  }

  const metrics = useMemo(() => {
    if (!session) return null;
    const sets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.status === "completed");
    return {
      exercises: session.exercises.filter((exercise) => exercise.sets.some((set) => set.status === "completed")).length,
      sets: sets.length,
      reps: sets.reduce((total, set) => total + set.reps, 0),
      volumeTenths: sets.reduce((total, set) => total + (set.loadTenthsLb ?? 0) * set.reps, 0),
    };
  }, [session]);

  if (!session || !metrics) return <main className="auth-shell"><p>Loading workout summary…</p></main>;

  const shown = editing && draft ? draft : session;

  return (
    <main className="summary-shell">
      <section className="summary-card">
        <span className="summary-check" aria-hidden="true">✓</span>
        <p className="eyebrow">Workout complete</p>
        <h1>{session.templateName}</h1>
        <div className="summary-grid">
          <div><strong>{metrics.exercises}</strong><span>Exercises</span></div>
          <div><strong>{metrics.sets}</strong><span>Working sets</span></div>
          <div><strong>{metrics.reps}</strong><span>Total reps</span></div>
          <div><strong>{(metrics.volumeTenths / 10).toLocaleString()}</strong><span>Recorded volume</span></div>
        </div>
        <p className="muted-copy summary-note">Volume uses the entered load, so dumbbell values remain per dumbbell and bodyweight is not inferred.</p>

        <section className="session-reflection">
          <div className="summary-exercise-heading"><h2>Session reflection</h2><span>Optional</span></div>
          {editing ? (
            <div className="session-reflection-fields">
              <label>Workout date<input max={localDateValue(new Date().toISOString())} onChange={(event) => setPerformedDate(event.target.value)} required type="date" value={performedDate} /></label>
              <label>Bodyweight (lb)<input inputMode="decimal" min="1" step="0.1" type="number" value={shown.bodyweightTenthsLb === null ? "" : shown.bodyweightTenthsLb / 10} onChange={(event) => updateSessionFields({ bodyweightTenthsLb: event.target.value === "" ? null : Math.round(Number(event.target.value) * 10) })} /></label>
              <label>Energy<select value={shown.energyRating ?? ""} onChange={(event) => updateSessionFields({ energyRating: event.target.value === "" ? null : Number(event.target.value) })}><option value="">Not recorded</option>{[1,2,3,4,5].map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Discomfort<select value={shown.discomfortLevel ?? ""} onChange={(event) => updateSessionFields({ discomfortLevel: event.target.value === "" ? null : event.target.value as ActiveWorkoutSession["discomfortLevel"] })}><option value="">Not recorded</option><option value="none">None</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label>
              <label>Discomfort details<textarea value={shown.discomfortNotes} onChange={(event) => updateSessionFields({ discomfortNotes: event.target.value })} /></label>
              <label>Session notes<textarea value={shown.sessionNotes} onChange={(event) => updateSessionFields({ sessionNotes: event.target.value })} /></label>
              <label>Next time<textarea value={shown.nextTimeAdjustment} onChange={(event) => updateSessionFields({ nextTimeAdjustment: event.target.value })} /></label>
            </div>
          ) : (
            <dl className="session-reflection-values">
              <div><dt>Workout date</dt><dd>{new Date(shown.startedAt).toLocaleDateString()}</dd></div>
              <div><dt>Bodyweight</dt><dd>{shown.bodyweightTenthsLb === null ? "—" : `${shown.bodyweightTenthsLb / 10} lb`}</dd></div>
              <div><dt>Energy</dt><dd>{shown.energyRating ?? "—"}</dd></div>
              <div><dt>Discomfort</dt><dd>{shown.discomfortLevel ?? "—"}{shown.discomfortNotes ? ` · ${shown.discomfortNotes}` : ""}</dd></div>
              <div><dt>Notes</dt><dd>{shown.sessionNotes || "—"}</dd></div>
              <div><dt>Next time</dt><dd>{shown.nextTimeAdjustment || "—"}</dd></div>
            </dl>
          )}
        </section>

        <div className="summary-exercises">
          {shown.exercises.map((exercise, exerciseIndex) => (
            <section className="summary-exercise" key={exercise.id}>
              <div className="summary-exercise-heading"><h2>{exercise.name}</h2><span>{exercise.targetRirLabel} RIR</span></div>
              <div className="summary-set-list">
                {exercise.sets.map((set, setIndex) => set.status === "completed" ? (
                  <div className="summary-set-row" key={set.id}>
                    <strong>Set {set.setNumber}</strong>
                    {editing ? (
                      <>
                        {set.loadMode === "bodyweight_only" ? <span>Bodyweight</span> : (
                          <label><span>Weight</span><input inputMode="decimal" min="0" onChange={(event) => updateSet(exerciseIndex, setIndex, "loadTenthsLb", event.target.value)} type="number" value={set.loadTenthsLb === null ? "" : set.loadTenthsLb / 10} /></label>
                        )}
                        <label><span>Reps</span><input inputMode="numeric" min="0" onChange={(event) => updateSet(exerciseIndex, setIndex, "reps", event.target.value)} type="number" value={set.reps} /></label>
                      </>
                    ) : (
                      <><span>{set.loadMode === "bodyweight_only" ? "Bodyweight" : `${(set.loadTenthsLb ?? 0) / 10} lb`}</span><span>{set.reps} reps</span></>
                    )}
                  </div>
                ) : null)}
              </div>
              {editing ? <label className="summary-notes"><span>Exercise notes</span><textarea onChange={(event) => updateNotes(exerciseIndex, event.target.value)} value={exercise.notes} /></label> : exercise.notes ? <p className="summary-notes-copy">{exercise.notes}</p> : null}
              {!editing ? (() => {
                const result = evaluateProgression(exercise, shown.programWeek);
                return (
                  <div className={`progression-callout progression-${result.state}`}>
                    <strong>{result.state === "eligible" ? "Eligible to increase" : result.state === "review" ? "Review progression" : "Maintain and build"}</strong>
                    <p>{result.explanation}{result.suggestedLoadTenthsLb !== null ? ` Consider ${result.suggestedLoadTenthsLb / 10} lb next time.` : ""}</p>
                  </div>
                );
              })() : null}
            </section>
          ))}
        </div>

        {message ? <p className="form-message" role="status">{message}</p> : null}
        <div className="summary-actions">
          {editing ? (
            <><button className="primary-button" onClick={saveUpdates} type="button">Save Updates</button><button className="secondary-button" onClick={() => { setEditing(false); setDraft(null); }} type="button">Cancel</button></>
          ) : <button className="secondary-button" onClick={beginEditing} type="button">Edit Workout</button>}
          {session.templateSequence === program.workoutsPerWeek ? <Link className="weekly-review-link" href={`/check-in?week=${session.programWeek}`}>Complete Week {session.programWeek} Review</Link> : null}
          <Link className="primary-link" href="/">Return to Today</Link>
        </div>
      </section>
      <BottomNavigation />
    </main>
  );
}
