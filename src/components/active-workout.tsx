"use client";

import { useActiveProgram } from "@/lib/program/use-active-program";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { getRemoteSession, listAvailableSessions } from "@/lib/workout/history";
import { findPreviousExercise, formatPreviousSets } from "@/lib/workout/previous-performance";
import { flushWorkoutOutbox, syncWorkoutSession, WorkoutSyncConflictError } from "@/lib/workout/sync";
import type { ActiveWorkoutSession, WorkoutSetDraft } from "@/lib/workout/types";
import type { ProgramDocument } from "@/lib/program/schema";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";

function loadLabel(loadBasis: string): string {
  if (loadBasis === "per_dumbbell") return "lb each";
  if (loadBasis === "added_bodyweight") return "lb added";
  if (loadBasis === "bodyweight_only") return "bodyweight";
  return "lb total";
}

function timerLabel(remainingSeconds: number): string {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type LibraryExercise = ProgramDocument["exercises"][number] & { isCustom?: boolean };

function muscleLabel(slug: string) {
  return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function ActiveWorkout() {
  const router = useRouter();
  const { document: program } = useActiveProgram();
  const [session, setSession] = useState<ActiveWorkoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [showReplacements, setShowReplacements] = useState(false);
  const [showFinishPanel, setShowFinishPanel] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmSkipExercise, setConfirmSkipExercise] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [history, setHistory] = useState<ActiveWorkoutSession[]>([]);
  const [recordCelebration, setRecordCelebration] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [repInputs, setRepInputs] = useState<Record<string, string>>({});
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [addedExerciseSlug, setAddedExerciseSlug] = useState("");
  const [addedExerciseSets, setAddedExerciseSets] = useState(1);
  const [exerciseLibrary, setExerciseLibrary] = useState<LibraryExercise[]>(program.exercises);
  const [showCustomExercise, setShowCustomExercise] = useState(false);
  const [customExercise, setCustomExercise] = useState({ name: "", equipment: "", loadBasis: "external_total", incrementLb: "2.5", restSeconds: "120", primaryMuscle: program.muscleGroups[0] ?? "" });
  const [creatingExercise, setCreatingExercise] = useState(false);
  const syncTimer = useRef<number | null>(null);
  const cancelPanel = useRef<HTMLElement | null>(null);
  const itineraryDragStart = useRef<number | null>(null);
  const [itineraryDropIndex, setItineraryDropIndex] = useState<number | null>(null);

  useEffect(() => {
    workoutRepository
      .getActiveSession()
      .then((stored) => {
        setSession(stored);
        if (!stored) setError("There is no active workout on this device.");
      })
      .catch(() => setError("The active workout could not be restored."));
    void listAvailableSessions().then(setHistory);
    void createSupabaseBrowserClient().rpc("get_exercise_library").then(({ data }) => {
      if (!data) return;
      const completeLibrary = new Map<string, LibraryExercise>();
      for (const candidate of [...program.exercises, ...(data as LibraryExercise[])]) completeLibrary.set(candidate.slug, candidate);
      setExerciseLibrary([...completeLibrary.values()].sort((left, right) => left.name.localeCompare(right.name)));
    });
  }, [program.exercises]);

  useEffect(() => {
    async function flushAndRefresh() {
      await flushWorkoutOutbox();
      const stored = await workoutRepository.getActiveSession();
      if (stored) setSession(stored);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void flushAndRefresh();
    }

    void flushAndRefresh();
    window.addEventListener("online", flushAndRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", flushAndRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => () => {
    if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recordCelebration) return;
    const timeout = window.setTimeout(() => setRecordCelebration(null), 4_500);
    return () => window.clearTimeout(timeout);
  }, [recordCelebration]);

  const exercise = session?.exercises[session.activeExerciseIndex] ?? null;

  const activeSetIndex = exercise?.sets.findIndex((set) => set.status !== "completed" && set.status !== "skipped") ?? -1;
  const activeSet = activeSetIndex >= 0 ? exercise?.sets[activeSetIndex] ?? null : null;
  const remainingSeconds = (() => {
    if (!session?.restEndsAt) return 0;
    return Math.max(0, Math.ceil((new Date(session.restEndsAt).valueOf() - now) / 1_000));
  })();

  async function commit(next: ActiveWorkoutSession) {
    const updated = { ...next, updatedAt: new Date().toISOString(), syncStatus: "pending" as const };
    setSession(updated);
    try {
      await workoutRepository.saveActiveSession(updated);
      setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      setError(null);
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        void flushWorkoutOutbox().then(async () => {
          const stored = await workoutRepository.getSession(updated.id);
          if (stored) setSession((current) => current?.updatedAt === updated.updatedAt ? stored : current);
        });
      }, 800);
    } catch {
      setError("This change could not be saved locally. Keep this screen open and try again.");
    }
  }

  function updateActiveSet(change: (set: WorkoutSetDraft) => WorkoutSetDraft) {
    if (!session || !exercise || !activeSet || activeSetIndex < 0) return;
    const exercises = [...session.exercises];
    const sets = [...exercise.sets];
    sets[activeSetIndex] = change(activeSet);
    exercises[session.activeExerciseIndex] = { ...exercise, sets };
    void commit({ ...session, exercises });
  }

  function adjustLoad(direction: -1 | 1) {
    if (!exercise || !activeSet || activeSet.loadMode === "bodyweight_only") return;
    updateActiveSet((set) => ({
      ...set,
      loadTenthsLb: Math.max(0, (set.loadTenthsLb ?? 0) + direction * exercise.incrementTenthsLb),
    }));
  }

  function setExactLoad(value: string) {
    if (value === "") {
      updateActiveSet((set) => ({ ...set, loadTenthsLb: null }));
      return;
    }
    const pounds = Number(value);
    if (!Number.isFinite(pounds) || pounds < 0) return;
    updateActiveSet((set) => ({ ...set, loadTenthsLb: Math.round(pounds * 10) }));
  }

  function completeSet() {
    if (!session || !exercise || !activeSet) return;
    const requiresLoad = !["bodyweight_only", "repetition_only"].includes(activeSet.loadMode);
    if (requiresLoad && activeSet.loadTenthsLb === null) {
      setError("Enter a load before completing this set.");
      return;
    }
    if (activeSet.loadTenthsLb !== null) {
      const priorSets = history
        .filter((item) => item.id !== session.id && item.status !== "active")
        .flatMap((item) => item.exercises)
        .filter((item) => item.performedExerciseSlug === exercise.performedExerciseSlug)
        .flatMap((item) => item.sets)
        .filter((set) => set.status === "completed" && set.loadMode === activeSet.loadMode && set.loadTenthsLb !== null);
      if (priorSets.length === 0) setRecordCelebration("First personal best recorded");
      else {
        const loadRecord = activeSet.loadTenthsLb > Math.max(...priorSets.map((set) => set.loadTenthsLb ?? 0));
        const volumeRecord = activeSet.loadTenthsLb * activeSet.reps > Math.max(...priorSets.map((set) => (set.loadTenthsLb ?? 0) * set.reps));
        if (loadRecord && volumeRecord) setRecordCelebration("New weight and set-volume records");
        else if (loadRecord) setRecordCelebration("New highest weight");
        else if (volumeRecord) setRecordCelebration("New set-volume record");
      }
    }
    const restEndsAt = new Date(now + exercise.restSeconds * 1_000).toISOString();
    const exercises = [...session.exercises];
    const sets = [...exercise.sets];
    sets[activeSetIndex] = { ...activeSet, status: "awaiting_rir", completedAt: new Date().toISOString() };
    exercises[session.activeExerciseIndex] = { ...exercise, sets };
    void commit({ ...session, exercises, restEndsAt });
  }

  function confirmRir(onTarget: boolean, actualRir: WorkoutSetDraft["actualRir"] = null) {
    if (!session || !exercise || !activeSet || activeSetIndex < 0) return;
    const exercises = [...session.exercises];
    const sets = [...exercise.sets];
    sets[activeSetIndex] = { ...activeSet, status: "completed", rirOnTarget: onTarget, actualRir };
    const nextSetIndex = sets.findIndex((set, index) => index > activeSetIndex && set.status === "draft");
    if (nextSetIndex >= 0) sets[nextSetIndex] = { ...sets[nextSetIndex], loadMode: activeSet.loadMode, loadTenthsLb: activeSet.loadTenthsLb };
    exercises[session.activeExerciseIndex] = { ...exercise, sets };
    void commit({ ...session, exercises });
  }

  function moveUpcomingExercise(index: number, target: number) {
    if (!session) return;
    if (index <= session.activeExerciseIndex || target <= session.activeExerciseIndex || target >= session.exercises.length) return;
    const exercises = [...session.exercises];
    const [moved] = exercises.splice(index, 1);
    exercises.splice(target, 0, moved);
    void commit({ ...session, exercises });
  }

  function finishItineraryDrag() {
    const from = itineraryDragStart.current; const to = itineraryDropIndex;
    itineraryDragStart.current = null; setItineraryDropIndex(null);
    if (from !== null && to !== null && from !== to) moveUpcomingExercise(from, to);
  }

  function makeExerciseCurrent(index: number) {
    if (!session || index <= session.activeExerciseIndex || index >= session.exercises.length) return;
    const exercises = [...session.exercises];
    [exercises[session.activeExerciseIndex], exercises[index]] = [exercises[index], exercises[session.activeExerciseIndex]];
    setShowReplacements(false);
    void commit({ ...session, exercises });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function undoSet(setIndex: number) {
    if (!session || !exercise) return;
    const exercises = [...session.exercises];
    const sets = [...exercise.sets];
    sets[setIndex] = { ...sets[setIndex], status: "draft", rirOnTarget: null, actualRir: null, completedAt: null };
    exercises[session.activeExerciseIndex] = { ...exercise, sets };
    void commit({ ...session, exercises });
  }

  function moveToNextExercise() {
    if (!session) return;
    void commit({ ...session, activeExerciseIndex: Math.min(session.exercises.length - 1, session.activeExerciseIndex + 1) });
  }

  function skipExercise() {
    if (!session || !exercise) return;
    const exercises = [...session.exercises];
    const sets = exercise.sets.map((set) => set.status === "completed" ? set : { ...set, status: "skipped" as const, rirOnTarget: null, actualRir: null, completedAt: null });
    const reasonLabel = skipReason === "time" ? "short on time" : skipReason === "fatigue" ? "fatigue or recovery" : skipReason === "equipment" ? "equipment unavailable" : skipReason === "preference" ? "chose not to perform" : "";
    const skipNote = reasonLabel ? `Skipped ${exercise.name}: ${reasonLabel}.` : "";
    exercises[session.activeExerciseIndex] = { ...exercise, sets };
    setConfirmSkipExercise(false);
    setSkipReason("");
    void commit({ ...session, exercises, restEndsAt: null, sessionNotes: skipNote ? [session.sessionNotes, skipNote].filter(Boolean).join("\n") : session.sessionNotes });
  }

  function undoExerciseSkip() {
    if (!session || !exercise) return;
    const exercises = [...session.exercises];
    exercises[session.activeExerciseIndex] = { ...exercise, sets: exercise.sets.map((set) => set.status === "skipped" ? { ...set, status: "draft" as const } : set) };
    void commit({ ...session, exercises });
  }

  function replaceExercise(replacementSlug: string) {
    if (!session || !exercise) return;
    const replacement = program.exercises.find((candidate) => candidate.slug === replacementSlug);
    if (!replacement) return;
    const exercises = [...session.exercises];
    exercises[session.activeExerciseIndex] = {
      ...exercise,
      performedExerciseSlug: replacement.slug,
      replacementReason: "equipment_unavailable",
      name: replacement.name,
      loadBasis: replacement.loadBasis,
      incrementTenthsLb: replacement.defaultIncrementTenthsLb,
      restSeconds: replacement.defaultRestSeconds,
      sets: exercise.sets.map((set) => ({
        ...set,
        loadMode: replacement.loadBasis,
        loadTenthsLb: null,
      })),
    };
    setShowReplacements(false);
    void commit({ ...session, exercises });
  }

  function addExerciseToSession() {
    if (!session || !addedExerciseSlug) return;
    const definition = exerciseLibrary.find((candidate) => candidate.slug === addedExerciseSlug);
    if (!definition) return;
    const prescription = program.workoutTemplates.flatMap((template) => template.exercises).find((candidate) => candidate.exercise === definition.slug);
    const repMin = prescription?.repMin ?? 8;
    const repMax = prescription?.repMax ?? 15;
    const loadMode = definition.loadBasis;
    const added = {
      id: crypto.randomUUID(), prescribedExerciseSlug: definition.slug, performedExerciseSlug: definition.slug,
      replacementReason: null, name: definition.name, repMin, repMax, targetRirLabel: session.targetRirLabel,
      loadBasis: definition.loadBasis, incrementTenthsLb: prescription?.incrementTenthsLb ?? definition.defaultIncrementTenthsLb,
      restSeconds: prescription?.restSeconds ?? definition.defaultRestSeconds, notes: "",
      sets: Array.from({ length: addedExerciseSets }, (_, index) => ({ id: crypto.randomUUID(), setNumber: index + 1, status: "draft" as const, loadMode, loadTenthsLb: null, reps: repMin, rirOnTarget: null, actualRir: null, completedAt: null })),
    };
    void commit({ ...session, exercises: [...session.exercises, added] });
    setShowAddExercise(false); setAddedExerciseSlug(""); setAddedExerciseSets(1);
  }

  async function createCustomExercise() {
    if (!customExercise.name.trim() || !customExercise.equipment.trim() || !customExercise.primaryMuscle) return;
    setCreatingExercise(true); setError(null);
    const { data, error: createError } = await createSupabaseBrowserClient().rpc("create_custom_exercise", {
      p_name: customExercise.name.trim(), p_equipment: customExercise.equipment.trim(), p_load_basis: customExercise.loadBasis,
      p_increment_tenths_lb: Math.max(1, Math.round(Number(customExercise.incrementLb) * 10)),
      p_rest_seconds: Math.max(30, Math.min(600, Math.round(Number(customExercise.restSeconds)))), p_primary_muscle: customExercise.primaryMuscle,
    });
    if (createError) { setError(createError.message); setCreatingExercise(false); return; }
    const created = data as LibraryExercise;
    setExerciseLibrary((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
    setAddedExerciseSlug(created.slug); setShowCustomExercise(false); setCreatingExercise(false);
    setCustomExercise({ name: "", equipment: "", loadBasis: "external_total", incrementLb: "2.5", restSeconds: "120", primaryMuscle: program.muscleGroups[0] ?? "" });
  }

  function addRestTime(seconds: number) {
    if (!session) return;
    const base = session.restEndsAt && new Date(session.restEndsAt).valueOf() > now
      ? new Date(session.restEndsAt).valueOf()
      : now;
    void commit({ ...session, restEndsAt: new Date(base + seconds * 1_000).toISOString() });
  }

  function dismissTimer() {
    if (session) void commit({ ...session, restEndsAt: null });
  }

  async function finishWorkout() {
    if (!session) return;
    const hasSkippedSets = session.exercises.some((item) => item.sets.some((set) => set.status === "skipped"));
    const completed = { ...session, status: hasSkippedSets ? "partial" as const : "completed" as const, restEndsAt: null, finishedAt: new Date().toISOString() };
    await commit(completed);
    if (syncTimer.current !== null) { window.clearTimeout(syncTimer.current); syncTimer.current = null; }
    if (navigator.onLine) await flushWorkoutOutbox();
    router.push(`/workout/summary?session=${completed.id}`);
  }

  async function useServerVersion() {
    if (!session) return;
    setError(null);
    try {
      const remote = await getRemoteSession(session.id);
      if (!remote) throw new Error("Remote workout not found");
      await workoutRepository.acceptRemoteSession(remote);
      setSession({ ...remote, syncStatus: "synced" });
    } catch {
      setError("The server version could not be loaded. Check your connection and try again.");
    }
  }

  async function keepDeviceVersion() {
    if (!session) return;
    setError(null);
    try {
      const remote = await getRemoteSession(session.id);
      if (!remote) throw new Error("Remote workout not found");
      const pending = { ...session, serverRevision: remote.serverRevision, updatedAt: new Date().toISOString(), syncStatus: "pending" as const };
      await workoutRepository.saveActiveSession(pending);
      setSession(pending);
      const result = await syncWorkoutSession(pending);
      const synced = { ...pending, serverRevision: result.serverRevision, syncStatus: "synced" as const };
      await workoutRepository.markSessionSynced(synced);
      setSession(synced);
    } catch (resolutionError) {
      if (resolutionError instanceof WorkoutSyncConflictError) {
        setError("The server changed again while resolving this conflict. Review both versions once more.");
      } else {
        setError("This device version could not be synchronized. Check your connection and try again.");
      }
    }
  }

  async function cancelWorkout() {
    if (!session) return;
    setCancelling(true);
    setError(null);
    try {
      const { data, error: abandonError } = await createSupabaseBrowserClient().rpc("abandon_workout_session", {
        p_session_id: session.id,
      });
      if (abandonError || data !== true) throw new Error(abandonError?.message ?? "Workout could not be abandoned");
      await workoutRepository.clearActiveSession();
      router.replace("/");
    } catch {
      setError("The workout could not be cancelled safely. Check your connection and try again.");
      setCancelling(false);
    }
  }

  if (!session) {
    return (
      <main className="workout-shell loading-workout">
        <p>{error ?? "Restoring workout…"}</p>
        {error ? <button className="secondary-button" onClick={() => router.push("/")} type="button">Back to Today</button> : null}
      </main>
    );
  }

  if (!exercise) return null;
  const exerciseComplete = exercise.sets.every((set) => set.status === "completed" || set.status === "skipped");
  const exerciseWasSkipped = exercise.sets.some((set) => set.status === "skipped");
  const completedSetCount = exercise.sets.filter((set) => set.status === "completed").length;
  const isLastExercise = session.activeExerciseIndex === session.exercises.length - 1;
  const performedDefinition = program.exercises.find((candidate) => candidate.slug === exercise.performedExerciseSlug);
  const editingNote = editingNoteId === exercise.id;
  const primaryMuscles = new Set(performedDefinition?.muscles.filter((muscle) => muscle.contribution === 1).map((muscle) => muscle.muscle));
  const replacementOptions = program.exercises
    .filter((candidate) => candidate.slug !== exercise.performedExerciseSlug)
    .map((candidate) => ({
      ...candidate,
      matchCount: candidate.muscles.filter((muscle) => muscle.contribution === 1 && primaryMuscles.has(muscle.muscle)).length,
    }))
    .sort((left, right) => right.matchCount - left.matchCount || left.name.localeCompare(right.name));
  const canReplace = exercise.sets.every((set) => set.status === "draft");
  const previousHistory = history.filter((item) => item.id !== session.id).filter((item) =>
    item.programSlug !== session.programSlug
    || item.cycleStartsOn !== session.cycleStartsOn
    || item.sequenceInCycle < session.sequenceInCycle,
  );
  const previous = findPreviousExercise(previousHistory, exercise.performedExerciseSlug);

  return (
    <main className="workout-shell">
      <header className="workout-header">
        <button className="text-button" onClick={() => router.push("/")} type="button">Minimize</button>
        <div>
          <strong>{session.activeExerciseIndex + 1} of {session.exercises.length}</strong>
          <span>{savedAt ? `Saved locally ${savedAt}` : "Saved on this device"}</span>
        </div>
        <span className={`sync-chip sync-chip-${session.syncStatus}`}>
          {session.syncStatus === "synced" ? "Synced" : session.syncStatus === "conflict" ? "Conflict" : "Pending"}
        </span>
        <Link className="workout-settings-link" href="/settings" aria-label="Open settings">⚙</Link>
      </header>

      {session.restEndsAt ? (
        <section className={`timer-bar${remainingSeconds === 0 ? " timer-finished" : ""}`} aria-label="Rest timer">
          <div><span>Rest</span><strong>{timerLabel(remainingSeconds)}</strong></div>
          <div className="timer-actions">
            <button onClick={() => addRestTime(30)} type="button">+30</button>
            <button onClick={dismissTimer} type="button">Dismiss</button>
          </div>
        </section>
      ) : null}

      {recordCelebration ? (
        <div className="confetti-celebration" role="status" aria-live="polite">
          <span className="sr-only">{recordCelebration} for {exercise.name}</span>
          {Array.from({ length: 80 }, (_, index) => { const dx = ((index * 61) % 110) - 55; const spin = 540 + ((index * 71) % 720); return <i aria-hidden="true" key={index} style={{ "--dx": `${dx}vw`, "--dx-final": `${dx * 1.12}vw`, "--peak": `${-28 - ((index * 43) % 45)}vh`, "--delay": `${(index % 13) * -38}ms`, "--spin-mid": `${spin * .55}deg`, "--spin": `${spin}deg`, "--color": `hsl(${(index * 47) % 360} 86% 58%)`, "--duration": `${3.1 + (index % 7) * .16}s` } as CSSProperties} />; })}
          <strong>{recordCelebration}</strong>
        </div>
      ) : null}

      {session.syncStatus === "conflict" ? (
        <section className="sync-conflict-panel" role="alert">
          <div><strong>This workout changed on another device</strong><p>Choose which complete version to keep. Nothing will be discarded until you decide.</p></div>
          <button onClick={useServerVersion} type="button">Use Server Version</button>
          <button onClick={keepDeviceVersion} type="button">Keep This Device</button>
        </section>
      ) : null}

      {confirmCancel ? (
        <section className="cancel-workout-panel" ref={cancelPanel} role="alertdialog" aria-labelledby="cancel-workout-title" aria-describedby="cancel-workout-description" tabIndex={-1}>
          <div><strong id="cancel-workout-title">Cancel this workout?</strong><p id="cancel-workout-description">Its entries will be discarded and this workout will return to the front of your program queue.</p></div>
          <button className="danger-button" disabled={cancelling} onClick={cancelWorkout} type="button">{cancelling ? "Cancelling…" : "Discard Accidental Workout"}</button>
          <button disabled={cancelling} onClick={() => setConfirmCancel(false)} type="button">Keep Workout</button>
        </section>
      ) : null}

      <section className="exercise-card">
        <div className="exercise-heading">
          <div>
            <p className="eyebrow">{session.phase} · Target {exercise.targetRirLabel} RIR</p>
            <h1>{exercise.name}</h1>
            <p className="muted-copy">{exercise.repMin}–{exercise.repMax} reps · {exercise.sets.length} working {exercise.sets.length === 1 ? "set" : "sets"}</p>
            <div className="exercise-muscle-chips" aria-label="Muscles trained">{performedDefinition?.muscles.map((muscle) => <span className={muscle.contribution === .5 ? "secondary" : ""} key={muscle.muscle}>{muscleLabel(muscle.muscle)}{muscle.contribution === .5 ? " · secondary" : ""}</span>)}</div>
          </div>
          <div className="exercise-heading-actions">
            <button className="replace-button" disabled={!canReplace} onClick={() => setShowReplacements((visible) => !visible)} type="button">Replace</button>
            {!exerciseComplete && !confirmSkipExercise ? <button className="replace-button skip-exercise-button" onClick={() => setConfirmSkipExercise(true)} type="button">Skip</button> : null}
          </div>
        </div>

        {showReplacements ? (
          <div className="replacement-panel">
            <div><strong>Replace exercise</strong><button aria-label="Close replacement options" onClick={() => setShowReplacements(false)} type="button">×</button></div>
            <p>Compatible muscle-group matches appear first. The performed exercise will be preserved separately from the prescription.</p>
            <div className="replacement-list">
              {replacementOptions.map((candidate) => (
                <button key={candidate.slug} onClick={() => replaceExercise(candidate.slug)} type="button">
                  <span>{candidate.name}</span>
                  <small>{candidate.matchCount > 0 ? "Compatible" : candidate.equipment}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="set-progress-row"><span>Set</span><div className="set-progress" aria-label="Set progress">
          {exercise.sets.map((set, index) => (
            <button
              className={set.status === "completed" ? "set-dot set-dot-complete" : index === activeSetIndex ? "set-dot set-dot-active" : "set-dot"}
              disabled={set.status !== "completed"}
              key={set.id}
              onClick={() => undoSet(index)}
              type="button"
            >
              {set.status === "completed" ? "✓" : set.setNumber}
              <span className="sr-only">{set.status === "completed" ? `Undo set ${set.setNumber}` : `Set ${set.setNumber}`}</span>
            </button>
          ))}
        </div></div>

        {previous ? (
          <div className="previous-performance">
            <span>Previous · Week {previous.session.programWeek}</span>
            <p>{formatPreviousSets(previous.exercise)}</p>
          </div>
        ) : <p className="previous-performance-empty">No previous performance yet. This session establishes your baseline.</p>}

        {activeSet?.status === "awaiting_rir" ? (
          <div className="rir-confirmation" aria-live="polite">
            <p>Was this set within the target {exercise.targetRirLabel} RIR?</p>
            <div className="rir-primary-actions">
              <button className="primary-button" onClick={() => confirmRir(true)} type="button">Yes, on target</button>
              <details>
                <summary>No, different RIR</summary>
                <div className="rir-options">
                  {[0, 1, 2, 3, 4, 5, "6+", "unsure"].map((rir) => (
                    <button key={rir} onClick={() => confirmRir(false, rir as WorkoutSetDraft["actualRir"])} type="button">
                      {rir === "unsure" ? "Unsure" : rir}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>
        ) : activeSet ? (
          <div className="active-set-controls">
            <div className="control-label"><span>Weight</span><small>{loadLabel(activeSet.loadMode)}</small></div>
            {exercise.loadBasis === "added_bodyweight" ? (
              <div className="segmented-control load-mode-control" aria-label="Pull-up load mode">
                <button
                  aria-pressed={activeSet.loadMode === "added_bodyweight"}
                  onClick={() => updateActiveSet((set) => ({ ...set, loadMode: "added_bodyweight" }))}
                  type="button"
                >Added weight</button>
                <button
                  aria-pressed={activeSet.loadMode === "bodyweight_only"}
                  onClick={() => updateActiveSet((set) => ({ ...set, loadMode: "bodyweight_only", loadTenthsLb: null }))}
                  type="button"
                >Bodyweight only</button>
              </div>
            ) : null}
            {activeSet.loadMode === "bodyweight_only" ? (
              <div className="bodyweight-value">Bodyweight</div>
            ) : (
              <div className="stepper-row">
                <button aria-label={`Decrease weight by ${exercise.incrementTenthsLb / 10} pounds`} onClick={() => adjustLoad(-1)} type="button">−{exercise.incrementTenthsLb / 10}</button>
                <label className="exact-value">
                  <span className="sr-only">Exact weight in pounds</span>
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => setExactLoad(event.target.value)}
                    placeholder="—"
                    step="0.1"
                    type="number"
                    value={activeSet.loadTenthsLb === null ? "" : activeSet.loadTenthsLb / 10}
                  />
                  <small>{loadLabel(activeSet.loadMode)}</small>
                </label>
                <button aria-label={`Increase weight by ${exercise.incrementTenthsLb / 10} pounds`} onClick={() => adjustLoad(1)} type="button">+{exercise.incrementTenthsLb / 10}</button>
              </div>
            )}

            <div className="control-label"><span>Reps</span><small>Target {exercise.repMin}–{exercise.repMax}</small></div>
            <div className="stepper-row">
              <button aria-label="Decrease repetitions by one" onClick={() => { setRepInputs((values) => { const next = { ...values }; delete next[activeSet.id]; return next; }); updateActiveSet((set) => ({ ...set, reps: Math.max(1, set.reps - 1) })); }} type="button">−1</button>
              <label className="exact-value">
                <span className="sr-only">Exact repetitions</span>
                <input
                  inputMode="numeric"
                  min="1"
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!/^\d*$/.test(value)) return;
                    setRepInputs((values) => ({ ...values, [activeSet.id]: value }));
                    const reps = Number.parseInt(value, 10);
                    if (Number.isInteger(reps) && reps > 0) updateActiveSet((set) => ({ ...set, reps }));
                  }}
                  onBlur={() => setRepInputs((values) => { const next = { ...values }; delete next[activeSet.id]; return next; })}
                  pattern="[0-9]*"
                  type="text"
                  value={repInputs[activeSet.id] ?? activeSet.reps}
                />
                <small>reps</small>
              </label>
              <button aria-label="Increase repetitions by one" onClick={() => { setRepInputs((values) => { const next = { ...values }; delete next[activeSet.id]; return next; }); updateActiveSet((set) => ({ ...set, reps: set.reps + 1 })); }} type="button">+1</button>
            </div>

            <button className="primary-button complete-set-button" onClick={completeSet} type="button">Complete Set {activeSet.setNumber}</button>
          </div>
        ) : null}

        {exerciseComplete ? (
          <div className="exercise-complete">
            <strong>{exerciseWasSkipped ? `${exercise.name} skipped` : `${exercise.name} complete`}</strong>
            <p>{exerciseWasSkipped ? `${completedSetCount} completed · ${exercise.sets.length - completedSetCount} skipped` : `${exercise.sets.length} working ${exercise.sets.length === 1 ? "set" : "sets"} saved.`}</p>
            {exerciseWasSkipped ? <button className="undo-skip-button" onClick={undoExerciseSkip} type="button">Undo Skip</button> : null}
            {isLastExercise && showFinishPanel ? (
              <div className="finish-workout-panel">
                <h2>Finish session</h2>
                <p>Everything below is optional. Your completed sets are already safe.</p>
                <label>Bodyweight (lb)<input inputMode="decimal" min="1" placeholder="Optional" step="0.1" type="number" value={session.bodyweightTenthsLb === null ? "" : session.bodyweightTenthsLb / 10} onChange={(event) => void commit({ ...session, bodyweightTenthsLb: event.target.value === "" ? null : Math.round(Number(event.target.value) * 10) })} /></label>
                <label>Energy<select value={session.energyRating ?? ""} onChange={(event) => void commit({ ...session, energyRating: event.target.value === "" ? null : Number(event.target.value) })}><option value="">Not recorded</option>{[1,2,3,4,5].map((value) => <option key={value} value={value}>{value} · {value === 1 ? "Very low" : value === 5 ? "Excellent" : ""}</option>)}</select></label>
                <label>Discomfort<select value={session.discomfortLevel ?? ""} onChange={(event) => void commit({ ...session, discomfortLevel: event.target.value === "" ? null : event.target.value as ActiveWorkoutSession["discomfortLevel"] })}><option value="">Not recorded</option><option value="none">None</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label>
                {session.discomfortLevel && session.discomfortLevel !== "none" ? <label>Discomfort details<textarea value={session.discomfortNotes} onChange={(event) => void commit({ ...session, discomfortNotes: event.target.value })} /></label> : null}
                <label>Session notes<textarea placeholder="What stood out?" value={session.sessionNotes} onChange={(event) => void commit({ ...session, sessionNotes: event.target.value })} /></label>
                <label>Next time<textarea placeholder="Adjustment or consideration for this workout next time" value={session.nextTimeAdjustment} onChange={(event) => void commit({ ...session, nextTimeAdjustment: event.target.value })} /></label>
                <button className="primary-button" onClick={finishWorkout} type="button">Save and Finish</button>
                <button className="text-button" onClick={() => setShowFinishPanel(false)} type="button">Back</button>
              </div>
            ) : (
              <button className="primary-button" onClick={isLastExercise ? () => setShowFinishPanel(true) : moveToNextExercise} type="button">
                {isLastExercise ? "Review and Finish" : "Next Exercise"}
              </button>
            )}
          </div>
        ) : null}

        <div className="active-exercise-notes">
          <div className="exercise-notes-heading"><strong>Exercise note</strong>{!editingNote ? <button onClick={() => { setNoteDraft(exercise.notes); setEditingNoteId(exercise.id); }} type="button">{exercise.notes ? "Edit note" : "+ Add note"}</button> : null}</div>
          {exercise.notes && !editingNote ? <p className="exercise-note-display">{exercise.notes}</p> : null}
          {editingNote ? <div className="exercise-note-editor"><label><span className="sr-only">Note for {exercise.name}</span><textarea autoFocus onFocus={(event) => event.currentTarget.setSelectionRange(event.currentTarget.value.length, event.currentTarget.value.length)} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Setup cue, seat position, technique reminder…" value={noteDraft} /></label><div className="exercise-note-actions"><button onClick={() => { setNoteDraft(exercise.notes); setEditingNoteId(null); }} type="button">Cancel</button><button className="primary-button" onClick={() => { const exercises = [...session.exercises]; exercises[session.activeExerciseIndex] = { ...exercise, notes: noteDraft.trim() }; void commit({ ...session, exercises }); setEditingNoteId(null); }} type="button">Save note</button></div></div> : null}
        </div>

        {confirmSkipExercise ? <div className="skip-exercise-panel" role="alertdialog" aria-label={`Skip ${exercise.name}?`}><strong>Skip the remaining sets?</strong><p>Completed sets will stay saved. Skipped sets won’t count toward volume or progression.</p><label>Reason <span>Optional</span><select onChange={(event) => setSkipReason(event.target.value)} value={skipReason}><option value="">No reason</option><option value="time">Short on time</option><option value="fatigue">Fatigue or recovery</option><option value="equipment">Equipment unavailable</option><option value="preference">Don’t want to do it today</option></select></label><div><button onClick={() => { setConfirmSkipExercise(false); setSkipReason(""); }} type="button">Keep Exercise</button><button className="danger-button" onClick={skipExercise} type="button">Skip Exercise</button></div></div> : null}

        {error ? <p className="form-message action-error" role="alert">{error}</p> : null}
        {!confirmCancel ? <button className="cancel-workout-trigger" onClick={() => { setConfirmCancel(true); window.requestAnimationFrame(() => { window.scrollTo({ top: 0, behavior: "smooth" }); cancelPanel.current?.focus(); }); }} type="button">Cancel Workout</button> : null}
      </section>

      <section className="workout-itinerary" aria-labelledby="up-next-title">
        <div className="itinerary-heading"><p className="eyebrow">Workout itinerary</p><h2 id="up-next-title">Up next</h2></div>
        <ol>
          {session.exercises.slice(session.activeExerciseIndex + 1).map((upcoming, offset) => {
            const absoluteIndex = session.activeExerciseIndex + offset + 1;
            const completed = upcoming.sets.filter((set) => set.status === "completed").length;
            return (
              <li className={itineraryDropIndex === absoluteIndex ? "drag-target" : undefined} data-itinerary-index={absoluteIndex} key={upcoming.id}>
                <span className="itinerary-number">{session.activeExerciseIndex + offset + 2}</span>
                <div><strong>{upcoming.name}</strong><small>{upcoming.sets.length} sets · {upcoming.repMin}–{upcoming.repMax} reps{completed ? ` · ${completed} completed` : ""}</small></div>
                <div className="itinerary-actions">
                  <button className="do-now-button" aria-label={`Make ${upcoming.name} the current exercise`} onClick={() => makeExerciseCurrent(absoluteIndex)} type="button">Do now</button>
                  <button className="drag-handle" aria-label={`Drag ${upcoming.name} to reorder`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); itineraryDragStart.current = absoluteIndex; setItineraryDropIndex(absoluteIndex); }} onPointerMove={(event) => { if (itineraryDragStart.current === null) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-itinerary-index]"); if (target) setItineraryDropIndex(Number(target.dataset.itineraryIndex)); }} onPointerUp={finishItineraryDrag} onPointerCancel={finishItineraryDrag} type="button">⠿</button>
                </div>
              </li>
            );
          })}
        </ol>
        {isLastExercise ? <p className="muted-copy">This is your final exercise.</p> : null}
        {!showAddExercise ? <button className="add-session-exercise-trigger" onClick={() => setShowAddExercise(true)} type="button">+ Add Exercise</button> : <div className="add-session-exercise-panel"><div><strong>Add to this workout</strong><button aria-label="Close add exercise panel" onClick={() => { setShowAddExercise(false); setAddedExerciseSlug(""); setShowCustomExercise(false); }} type="button">×</button></div><label>Exercise<select onChange={(event) => setAddedExerciseSlug(event.target.value)} value={addedExerciseSlug}><option value="">Choose from your exercise library</option>{exerciseLibrary.filter((candidate) => !session.exercises.some((item) => item.performedExerciseSlug === candidate.slug)).map((candidate) => <option key={candidate.slug} value={candidate.slug}>{candidate.name}</option>)}</select></label><button className="custom-exercise-toggle" onClick={() => setShowCustomExercise((shown) => !shown)} type="button">{showCustomExercise ? "Cancel custom exercise" : "+ Create custom exercise"}</button>{showCustomExercise ? <div className="custom-exercise-fields"><label>Name<input maxLength={120} onChange={(event) => setCustomExercise({ ...customExercise, name: event.target.value })} value={customExercise.name} /></label><label>Equipment<input maxLength={80} onChange={(event) => setCustomExercise({ ...customExercise, equipment: event.target.value })} placeholder="Cable, machine, dumbbell…" value={customExercise.equipment} /></label><label>Load entry<select onChange={(event) => setCustomExercise({ ...customExercise, loadBasis: event.target.value })} value={customExercise.loadBasis}><option value="external_total">Total weight</option><option value="per_dumbbell">Per dumbbell</option><option value="added_bodyweight">Added bodyweight</option><option value="bodyweight_only">Bodyweight only</option><option value="repetition_only">Reps only</option></select></label><label>Primary muscle<select onChange={(event) => setCustomExercise({ ...customExercise, primaryMuscle: event.target.value })} value={customExercise.primaryMuscle}>{program.muscleGroups.map((muscle) => <option key={muscle} value={muscle}>{muscleLabel(muscle)}</option>)}</select></label><label>Increment (lb)<input inputMode="decimal" min="0.1" onChange={(event) => setCustomExercise({ ...customExercise, incrementLb: event.target.value })} type="number" value={customExercise.incrementLb} /></label><label>Rest (seconds)<input inputMode="numeric" max="600" min="30" onChange={(event) => setCustomExercise({ ...customExercise, restSeconds: event.target.value })} type="number" value={customExercise.restSeconds} /></label><button className="secondary-button" disabled={creatingExercise || !customExercise.name.trim() || !customExercise.equipment.trim()} onClick={() => void createCustomExercise()} type="button">{creatingExercise ? "Creating…" : "Save Custom Exercise"}</button></div> : null}<label>Working sets<select onChange={(event) => setAddedExerciseSets(Number(event.target.value))} value={addedExerciseSets}>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count}</option>)}</select></label><button className="primary-button" disabled={!addedExerciseSlug} onClick={addExerciseToSession} type="button">Add to Itinerary</button><p>This changes today’s workout only.</p></div>}
      </section>
    </main>
  );
}
