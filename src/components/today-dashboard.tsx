"use client";

import { useActiveProgram } from "@/lib/program/use-active-program";
import type { ProgramWeek } from "@/lib/program/types";
import { createInitialSession } from "@/lib/workout/create-session";
import { listAvailableSessions } from "@/lib/workout/history";
import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { applyPreviousLoads } from "@/lib/workout/previous-performance";
import { flushWorkoutOutbox } from "@/lib/workout/sync";
import type { ActiveWorkoutSession } from "@/lib/workout/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlanLibrary } from "@/components/plan-library";

interface NextWorkout {
  sequenceInCycle: number;
  programWeek: ProgramWeek;
  templateSequence: number;
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

  useEffect(() => {
    void flushWorkoutOutbox();
    Promise.all([workoutRepository.getActiveSession(), listAvailableSessions()])
      .then(([active, sessions]) => {
        const cycleSessions = sessions.filter((session) => session.programSlug === program.slug && session.cycleStartsOn === cycleStartsOn);
        const cycleActive = active?.programSlug === program.slug && active.cycleStartsOn === cycleStartsOn ? active : null;
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
        setNextWorkout({
          sequenceInCycle,
          programWeek: Math.ceil(sequenceInCycle / program.workoutsPerWeek) as ProgramWeek,
          templateSequence: ((sequenceInCycle - 1) % program.workoutTemplates.length) + 1,
        });
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
      {error ? <p className="form-message action-error" role="alert">{error}</p> : null}
    </section>

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
