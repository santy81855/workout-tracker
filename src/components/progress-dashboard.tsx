"use client";

import { calculateExerciseStats } from "@/lib/analytics/exercise-stats";
import type { ProgramDocument } from "@/lib/program/schema";
import { useActiveProgram } from "@/lib/program/use-active-program";
import { listAvailableSessions } from "@/lib/workout/history";
import type { ActiveWorkoutSession } from "@/lib/workout/types";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnatomicalHeatMap } from "@/components/anatomical-heat-map";

function calculateMuscleSets(sessions: ActiveWorkoutSession[], program: ProgramDocument) {
  const exerciseCatalog = new Map(program.exercises.map((exercise) => [exercise.slug, exercise]));
  const totals = Object.fromEntries(program.muscleGroups.map((muscle) => [muscle, 0])) as Record<string, number>;
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const definition = exerciseCatalog.get(exercise.performedExerciseSlug);
      if (!definition) continue;
      const setCount = exercise.sets.filter((set) => set.status === "completed").length;
      for (const mapping of definition.muscles) totals[mapping.muscle] += setCount * mapping.contribution;
    }
  }
  return totals;
}

function calculateExpectedMuscleSets(week: number, program: ProgramDocument) {
  const exerciseCatalog = new Map(program.exercises.map((exercise) => [exercise.slug, exercise]));
  const weekRule = program.weekRules.find((rule) => rule.week === week) ?? program.weekRules[0];
  const totals = Object.fromEntries(program.muscleGroups.map((muscle) => [muscle, 0])) as Record<string, number>;
  for (const template of program.workoutTemplates) {
    for (const prescribed of template.exercises) {
      const definition = exerciseCatalog.get(prescribed.exercise);
      if (!definition) continue;
      const setCount = weekRule.setRules[`peak${prescribed.peakSets}` as "peak2" | "peak3" | "peak4"].required;
      for (const mapping of definition.muscles) totals[mapping.muscle] += setCount * mapping.contribution;
    }
  }
  return totals;
}

export function ProgressDashboard() {
  const { document: program, startsOn: cycleStartsOn } = useActiveProgram();
  const [sessions, setSessions] = useState<ActiveWorkoutSession[] | null>(null);
  const [mode, setMode] = useState<"completed" | "expected">("completed");

  useEffect(() => {
    void listAvailableSessions().then(setSessions);
  }, []);

  if (sessions === null) return <p className="muted-copy list-status">Loading progress…</p>;

  const completedSessions = sessions.filter((session) => session.status === "completed" || session.status === "partial");
  const currentCycleSessions = completedSessions.filter((session) => session.programSlug === program.slug && session.cycleStartsOn === cycleStartsOn);
  const highestSequence = currentCycleSessions.reduce((highest, session) => Math.max(highest, session.sequenceInCycle), 0);
  const totalSessions = program.weekCount * program.workoutsPerWeek;
  const currentWeek = Math.max(1, Math.min(program.weekCount, Math.ceil((highestSequence + (highestSequence < totalSessions ? 1 : 0)) / program.workoutsPerWeek)));
  const currentWeekSessions = currentCycleSessions.filter((session) => session.programWeek === currentWeek);
  const completedSets = calculateMuscleSets(currentWeekSessions, program);
  const expectedSets = calculateExpectedMuscleSets(currentWeek, program);
  const displayed = mode === "completed" ? completedSets : expectedSets;
  const allSets = completedSessions.flatMap((session) => session.exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => set.status === "completed").map((set) => ({ exercise, set })),
  ));
  const weightedSets = allSets.filter(({ set }) => set.loadTenthsLb !== null);
  const highest = weightedSets.reduce<(typeof weightedSets)[number] | null>((best, candidate) =>
    !best || (candidate.set.loadTenthsLb ?? 0) > (best.set.loadTenthsLb ?? 0) ? candidate : best, null);
  const bestVolume = weightedSets.reduce<(typeof weightedSets)[number] | null>((best, candidate) => {
    const candidateVolume = (candidate.set.loadTenthsLb ?? 0) * candidate.set.reps;
    const bestVolumeValue = best ? (best.set.loadTenthsLb ?? 0) * best.set.reps : -1;
    return candidateVolume > bestVolumeValue ? candidate : best;
  }, null);
  const exerciseStats = calculateExerciseStats(completedSessions);

  return (
    <>
      <div className="progress-week-banner"><span>Current progress</span><strong>Week {currentWeek} of {program.weekCount}</strong></div>
      <section className="record-grid" aria-label="Exercise records">
        <div><span>Highest load</span><strong>{highest ? `${(highest.set.loadTenthsLb ?? 0) / 10} lb` : "—"}</strong><small>{highest?.exercise.name ?? "Complete a workout"}</small></div>
        <div><span>Best set volume</span><strong>{bestVolume ? (((bestVolume.set.loadTenthsLb ?? 0) * bestVolume.set.reps) / 10).toLocaleString() : "—"}</strong><small>{bestVolume?.exercise.name ?? "Complete a workout"}</small></div>
      </section>

      <section className="program-section" aria-labelledby="muscle-sets-title">
        <div className="section-heading"><div><p className="eyebrow">Estimated exposure</p><h2 id="muscle-sets-title">Muscle-group sets</h2></div></div>
        <div className="segmented-control" aria-label="Muscle set view">
          <button aria-pressed={mode === "completed"} onClick={() => setMode("completed")} type="button">Completed</button>
          <button aria-pressed={mode === "expected"} onClick={() => setMode("expected")} type="button">Expected W{currentWeek}</button>
        </div>
        <AnatomicalHeatMap values={displayed} />
        <div className="muscle-grid">
          {program.muscleGroups.map((muscle) => {
            const sets = displayed[muscle];
            const percentage = Math.min(100, (sets / 15) * 100);
            return (
              <div className="muscle-row" key={muscle}>
                <div><span>{muscle}</span><strong>{sets.toFixed(sets % 1 === 0 ? 0 : 1)} / 15</strong></div>
                <div className="muscle-track"><span style={{ width: `${percentage}%` }} /></div>
              </div>
            );
          })}
        </div>
        <p className="legend-copy">Week {currentWeek}. Primary muscles count as one set; secondary muscles count as half. This is a planning estimate, not a stimulus measurement.</p>
        <p className="anatomy-credit">Anatomical SVG: Body Muscles, Apache-2.0.</p>
      </section>

      <section className="program-section" aria-labelledby="exercise-stats-title">
        <div className="section-heading"><div><p className="eyebrow">Exact exercise only</p><h2 id="exercise-stats-title">Exercise records</h2></div></div>
        {exerciseStats.length === 0 ? <p className="muted-copy list-status">Complete a workout to establish exercise records.</p> : (
          <div className="exercise-stat-list">
            {exerciseStats.map((stat) => (
              <article className="exercise-stat-card" key={stat.slug}>
                <Link href={`/progress/exercise/${encodeURIComponent(stat.slug)}`}><span>{stat.name}</span><small>{stat.sessions} {stat.sessions === 1 ? "session" : "sessions"} · View history →</small></Link>
                <dl>
                  <div><dt>Highest entered load</dt><dd>{stat.highestLoadTenthsLb === null ? "Bodyweight / —" : `${stat.highestLoadTenthsLb / 10} lb`}</dd></div>
                  <div><dt>Most reps in one set</dt><dd>{stat.mostReps}</dd></div>
                  <div><dt>Best set volume</dt><dd>{stat.bestSetVolumeTenths === null ? "—" : (stat.bestSetVolumeTenths / 10).toLocaleString()}</dd></div>
                  <div><dt>Completed sets</dt><dd>{stat.completedSets}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
        <p className="legend-copy">Loads retain their recorded meaning: per dumbbell, total external load, or added pull-up load. Estimated one-rep max is intentionally omitted because these high-rep sets do not support a dependable claim.</p>
      </section>
    </>
  );
}
