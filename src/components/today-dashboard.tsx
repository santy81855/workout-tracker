"use client";

import { useActiveProgram } from "@/lib/program/use-active-program";
import type { ProgramWeek } from "@/lib/program/types";
import { createInitialSession } from "@/lib/workout/create-session";
import { listAvailableSessions } from "@/lib/workout/history";
import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { applyPreviousLoads } from "@/lib/workout/previous-performance";
import { selectCycleActiveSession } from "@/lib/workout/active-session";
import { flushWorkoutOutbox } from "@/lib/workout/sync";
import type { ActiveWorkoutSession } from "@/lib/workout/types";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { PlanLibrary } from "@/components/plan-library";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface NextWorkout {
  sequenceInCycle: number;
  programWeek: ProgramWeek;
  templateSequence: number;
}
interface QueueRestDay { id: string; restDate: string }
interface QueuedWorkout extends NextWorkout { scheduledWorkoutId: string; templateName: string; scheduledDate: string; restDays: QueueRestDay[] }
type RecoverableSkippedWorkout = Omit<QueuedWorkout, "restDays">;

const UPCOMING_PREVIEW_COUNT = 5;
const UPCOMING_FETCH_LIMIT = 10;

function normalizeQueue(data: QueuedWorkout[] | null | undefined) {
  return (data ?? []).map((item) => ({ ...item, restDays: item.restDays ?? [] }));
}

export function TodayDashboard() {
  const router = useRouter();
  const { document: program, startsOn: cycleStartsOn, hasProgram, loading: programLoading } = useActiveProgram();
  const [activeSession, setActiveSession] = useState<ActiveWorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [cycleComplete, setCycleComplete] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<ActiveWorkoutSession[]>([]);
  const [nextWorkout, setNextWorkout] = useState<NextWorkout>({ sequenceInCycle: 1, programWeek: 1, templateSequence: 1 });
  const [upcomingQueue, setUpcomingQueue] = useState<QueuedWorkout[]>([]);
  const [reordering, setReordering] = useState(false);
  const [draggingQueueIndex, setDraggingQueueIndex] = useState<number | null>(null);
  const [queueDropIndex, setQueueDropIndex] = useState<number | null>(null);
  const [addingRest, setAddingRest] = useState(false);
  const [deletingRest, setDeletingRest] = useState<string | null>(null);
  const [recoverableSkip, setRecoverableSkip] = useState<RecoverableSkippedWorkout | null>(null);
  const [changingSkip, setChangingSkip] = useState(false);
  const dragStartIndex = useRef<number | null>(null);
  const draggingRestDay = useRef<string | null>(null);

  useEffect(() => {
    void flushWorkoutOutbox().then(() => Promise.all([
      workoutRepository.getActiveSession(),
      listAvailableSessions(),
      createSupabaseBrowserClient().rpc("get_upcoming_workout_queue", { p_limit: UPCOMING_FETCH_LIMIT }),
      createSupabaseBrowserClient().rpc("get_recoverable_skipped_workout"),
    ]))
      .then(([active, sessions, queueResult, skippedResult]) => {
        const cycleSessions = sessions.filter((session) => session.programSlug === program.slug && session.cycleStartsOn === cycleStartsOn);
        // An active workout may already have synced on another device (or have
        // outlived this browser's IndexedDB). Treat the server copy as active so
        // it cannot disappear from Today while its queue slot remains excluded.
        const cycleActive = selectCycleActiveSession(active, cycleSessions, program.slug, cycleStartsOn);
        setActiveSession(cycleActive);
        // Queue progress is cycle-scoped, while compatible prior loads may come from an archived cycle.
        setAvailableSessions(sessions);
        const resolvedSessions = cycleSessions.filter((session) => session.status === "completed" || session.status === "partial");
        const resolvedSequences = new Set(resolvedSessions.map((session) => session.sequenceInCycle));
        const highestResolvedSequence = resolvedSessions
          .reduce((highest, session) => Math.max(highest, session.sequenceInCycle), 0);
        setResolvedCount(resolvedSequences.size);
        const totalSessions = program.weekCount * program.workoutsPerWeek;
        setCycleComplete(!active && highestResolvedSequence >= totalSessions);
        const sequenceInCycle = Math.min(totalSessions, highestResolvedSequence + 1);
        const fallbackNext = {
          sequenceInCycle,
          programWeek: Math.ceil(sequenceInCycle / program.workoutsPerWeek) as ProgramWeek,
          templateSequence: ((sequenceInCycle - 1) % program.workoutTemplates.length) + 1,
        };
        const queue = (queueResult.error ? [] : normalizeQueue(queueResult.data as QueuedWorkout[] | null))
          .filter((item) => !resolvedSequences.has(item.sequenceInCycle))
          .slice(0, UPCOMING_PREVIEW_COUNT);
        setUpcomingQueue(queue);
        setNextWorkout(queue[0] ?? fallbackNext);
        setRecoverableSkip(skippedResult.error ? null : (skippedResult.data as RecoverableSkippedWorkout | null));
      })
      .catch(() => setError("The locally saved workout could not be loaded."))
      .finally(() => setLoading(false));
  }, [program.slug, program.weekCount, program.workoutsPerWeek, program.workoutTemplates.length, cycleStartsOn]);

  async function startWorkout() {
    setError(null);
    try {
      const session = activeSession ?? applyPreviousLoads(
        createInitialSession(nextWorkout.programWeek, nextWorkout.templateSequence, new Date(), program, cycleStartsOn, nextWorkout.sequenceInCycle),
        availableSessions,
      );
      await workoutRepository.saveActiveSession(session);
      router.push("/workout");
    } catch {
      setError("The workout could not be saved on this device.");
    }
  }

  async function moveQueuedWorkout(index: number, target: number) {
    if (activeSession || reordering || target < 0 || target >= upcomingQueue.length || index === target) return;
    setReordering(true); setError(null);
    const queue = [...upcomingQueue];
    const direction = target > index ? 1 : -1;
    try {
      for (let current = index; current !== target; current += direction) {
        const adjacent = current + direction;
        const first = queue[current]; const second = queue[adjacent];
        const { error: swapError } = await createSupabaseBrowserClient().rpc("swap_upcoming_workouts", { p_first_id: first.scheduledWorkoutId, p_second_id: second.scheduledWorkoutId });
        if (swapError) throw swapError;
        const firstContent = { templateSequence: first.templateSequence, templateName: first.templateName };
        queue[current] = { ...first, templateSequence: second.templateSequence, templateName: second.templateName };
        queue[adjacent] = { ...second, ...firstContent };
      }
      setUpcomingQueue(queue); setNextWorkout(queue[0]);
    } catch { setError("The upcoming workouts could not be reordered. Check your connection and try again."); }
    finally { setReordering(false); }
  }

  async function addRestDay() {
    if (!upcomingQueue[0] || activeSession || addingRest) return;
    setAddingRest(true); setError(null);
    const { error: restError } = await createSupabaseBrowserClient().rpc("insert_rest_day_before_workout", { p_scheduled_workout_id: upcomingQueue[0].scheduledWorkoutId });
    if (restError) setError("A rest day could not be added. Check your connection and try again.");
    else {
      const { data } = await createSupabaseBrowserClient().rpc("get_upcoming_workout_queue", { p_limit: UPCOMING_FETCH_LIMIT });
      setUpcomingQueue(normalizeQueue(data as QueuedWorkout[] | null).slice(0, UPCOMING_PREVIEW_COUNT));
    }
    setAddingRest(false);
  }

  function finishQueueDrag() {
    const from = dragStartIndex.current; const to = queueDropIndex;
    dragStartIndex.current = null; setDraggingQueueIndex(null); setQueueDropIndex(null);
    if (from !== null && to !== null) void moveQueuedWorkout(from, to);
  }

  async function finishRestDayDrag() {
    const restDayId = draggingRestDay.current; const target = queueDropIndex;
    draggingRestDay.current = null; setQueueDropIndex(null);
    if (!restDayId || target === null) return;
    setReordering(true); setError(null);
    const { error: moveError } = await createSupabaseBrowserClient().rpc("move_scheduled_rest_day", { p_rest_day_id: restDayId, p_before_workout_id: upcomingQueue[target].scheduledWorkoutId });
    if (moveError) setError("The rest day could not be moved. Check your connection and try again.");
    else {
      const { data } = await createSupabaseBrowserClient().rpc("get_upcoming_workout_queue", { p_limit: UPCOMING_FETCH_LIMIT });
      setUpcomingQueue(normalizeQueue(data as QueuedWorkout[] | null).slice(0, UPCOMING_PREVIEW_COUNT));
    }
    setReordering(false);
  }

  async function deleteRestDay(restDayId: string) {
    if (activeSession || deletingRest) return;
    setDeletingRest(restDayId); setError(null);
    const { error: deleteError } = await createSupabaseBrowserClient().rpc("remove_scheduled_rest_day", { p_rest_day_id: restDayId });
    if (deleteError) setError("The rest day could not be deleted. Check your connection and try again.");
    else {
      const { data } = await createSupabaseBrowserClient().rpc("get_upcoming_workout_queue", { p_limit: UPCOMING_FETCH_LIMIT });
      setUpcomingQueue(normalizeQueue(data as QueuedWorkout[] | null).slice(0, UPCOMING_PREVIEW_COUNT));
    }
    setDeletingRest(null);
  }

  async function changeSkippedWorkout(action: "skip" | "unskip") {
    const workout = action === "skip" ? upcomingQueue[0] : recoverableSkip;
    if (!workout || activeSession || changingSkip) return;
    if (action === "skip" && !window.confirm(`Skip ${workout.templateName}? You can undo this until you complete the next workout.`)) return;
    setChangingSkip(true); setError(null);
    const rpc = action === "skip" ? "skip_scheduled_workout" : "unskip_scheduled_workout";
    const { error: changeError } = await createSupabaseBrowserClient().rpc(rpc, { p_scheduled_workout_id: workout.scheduledWorkoutId });
    if (changeError) setError(changeError.message);
    else window.location.reload();
    setChangingSkip(false);
  }

  const displayedSession = activeSession;
  const template = program.workoutTemplates.find((candidate) => candidate.sequence === nextWorkout.templateSequence)
    ?? program.workoutTemplates[0];
  const displayedWeek = (displayedSession?.programWeek as ProgramWeek | undefined) ?? nextWorkout.programWeek;
  const weekRule = program.weekRules.find((rule) => rule.week === displayedWeek) ?? program.weekRules[0];
  const exerciseCount = displayedSession?.exercises.length ?? template.exercises.length;
  const workingSets = displayedSession
    ? displayedSession.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    : template.exercises.reduce((total, exercise) => total + weekRule.setRules[`peak${exercise.peakSets}` as "peak2" | "peak3" | "peak4"].required, 0);
  const totalSessions = program.weekCount * program.workoutsPerWeek;

  if (!programLoading && !hasProgram) return <PlanLibrary showStarter />;

  return (
    <>
    <section className="hero-card" aria-labelledby="next-workout-title">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Week {displayedWeek} · {weekRule.phase}</p>
          <h2 id="next-workout-title">{displayedSession?.templateName ?? template.name}</h2>
        </div>
        <span className="status-pill">{displayedSession ? "In progress" : cycleComplete ? "Cycle complete" : `Session ${nextWorkout.sequenceInCycle}`}</span>
      </div>

      <dl className="workout-facts">
        <div><dt>Target</dt><dd>{weekRule.targetRir.min === weekRule.targetRir.max ? weekRule.targetRir.min : `${weekRule.targetRir.min}–${weekRule.targetRir.max}`} RIR</dd></div>
        <div><dt>Exercises</dt><dd>{exerciseCount}</dd></div>
        <div><dt>Working sets</dt><dd>{workingSets}</dd></div>
      </dl>

      <button className="primary-button" disabled={loading || programLoading || cycleComplete} onClick={startWorkout} type="button">
        {loading ? "Checking saved workout…" : activeSession ? "Resume Workout" : cycleComplete ? "Cycle Complete" : "Start Workout"}
      </button>
      <p className="helper-text">
        {activeSession
          ? "An active workout is saved on this device."
          : cycleComplete
            ? `All ${totalSessions} sessions are complete. Choose your next plan when you’re ready.`
            : displayedWeek === 1
              ? "Week 1 starts with one working set per exercise."
              : `You’re now training in Week ${displayedWeek}.`}
      </p>
      {!activeSession && !cycleComplete && upcomingQueue[0] ? <button className="skip-workout-button" disabled={changingSkip} onClick={() => void changeSkippedWorkout("skip")} type="button">Skip this workout</button> : null}
      {error ? <p className="form-message action-error" role="alert">{error}</p> : null}
    </section>

    {upcomingQueue.length > 1 || recoverableSkip ? <section className="section-block upcoming-workout-queue" aria-labelledby="upcoming-workouts-title">
      <div className="section-heading"><div><p className="eyebrow">Flexible order</p><h2 id="upcoming-workouts-title">Upcoming workouts</h2></div><button className="add-rest-day-button" disabled={activeSession !== null || addingRest} onClick={() => void addRestDay()} type="button">{addingRest ? "Adding…" : "+ Rest day"}</button></div>
      <p className="muted-copy">Drag workouts into the order that fits your recovery. Adding a rest day moves the whole queue back one day.</p>
      <ol>{upcomingQueue.map((queued, index) => <Fragment key={queued.scheduledWorkoutId}>
        {queued.restDays.map((restDay) => <li className="queue-rest-day" key={restDay.id}><button className="drag-handle" aria-label={`Drag rest day before ${queued.templateName}`} disabled={activeSession !== null || reordering} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); draggingRestDay.current = restDay.id; setQueueDropIndex(index); }} onPointerMove={(event) => { if (!draggingRestDay.current) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-queue-index]"); if (target) setQueueDropIndex(Number(target.dataset.queueIndex)); }} onPointerUp={() => void finishRestDayDrag()} onPointerCancel={() => void finishRestDayDrag()} type="button">⠿</button><div><strong>Rest day</strong><small>Recovery before {queued.templateName}</small></div><button className="delete-rest-day" aria-label={`Delete rest day before ${queued.templateName}`} disabled={deletingRest !== null} onClick={() => void deleteRestDay(restDay.id)} type="button">{deletingRest === restDay.id ? "…" : "×"}</button></li>)}
        <li className={draggingQueueIndex === index ? "dragging" : queueDropIndex === index ? "drag-target" : undefined} data-queue-index={index}><button className="drag-handle" aria-label={`Drag ${queued.templateName}`} disabled={activeSession !== null || reordering} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragStartIndex.current = index; setDraggingQueueIndex(index); setQueueDropIndex(index); }} onPointerMove={(event) => { if (dragStartIndex.current === null) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-queue-index]"); if (target) setQueueDropIndex(Number(target.dataset.queueIndex)); }} onPointerUp={finishQueueDrag} onPointerCancel={finishQueueDrag} type="button">⠿</button><div><strong>{queued.templateName}</strong><small>Week {queued.programWeek} · {new Date(`${queued.scheduledDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</small></div></li>
      </Fragment>)}</ol>
      {recoverableSkip ? <div className="recoverable-skipped-workout"><div><span>Skipped</span><strong>{recoverableSkip.templateName}</strong><small>Week {recoverableSkip.programWeek} · restore before completing the next workout</small></div><button disabled={changingSkip || activeSession !== null} onClick={() => void changeSkippedWorkout("unskip")} type="button">{changingSkip ? "Restoring…" : "Unskip"}</button></div> : null}
      {activeSession ? <p className="helper-text">Finish or cancel the active workout before changing the queue.</p> : null}
    </section> : null}

    <section className="section-block" aria-labelledby="program-status-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cycle progress</p>
          <h2 id="program-status-title">{program.displayTitle ?? program.name}</h2>
        </div>
        <span className="metric">{resolvedCount} of {totalSessions} workouts</span>
      </div>
      <div className="progress-track" aria-label={`${resolvedCount} of ${totalSessions} workouts complete`}>
        <span style={{ width: `${Math.min(100, (resolvedCount / totalSessions) * 100)}%` }} />
      </div>
      <p className="cycle-phase">Week {displayedWeek} of {program.weekCount} · {cycleComplete ? "Complete" : weekRule.phase}</p>
      <p className="muted-copy">Finishing or intentionally shortening a workout moves you to the next session.</p>
    </section>
    </>
  );
}
