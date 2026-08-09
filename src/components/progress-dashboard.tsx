"use client";

import { calculateExerciseStats } from "@/lib/analytics/exercise-stats";
import type { ProgramDocument } from "@/lib/program/schema";
import { useActiveProgram } from "@/lib/program/use-active-program";
import { listAvailableSessions } from "@/lib/workout/history";
import type { ActiveWorkoutSession } from "@/lib/workout/types";
import { useEffect, useState } from "react";
import Link from "next/link";

function MuscleHeatMap({ values }: { values: Record<string, number> }) {
  const intensity = (muscle: string) => Math.max(0.12, Math.min(1, (values[muscle] ?? 0) / 15));
  const area = (muscle: string) => ({ opacity: intensity(muscle) });
  return (
    <div className="muscle-heat-map" aria-label="Body map showing weekly muscle-group set exposure">
      <div><span>Front</span><svg viewBox="0 0 140 300" role="img" aria-label="Front muscle exposure">
        <circle className="body-outline" cx="70" cy="24" r="17"/><path className="body-outline" d="M48 47 Q70 38 92 47 L106 132 92 176 89 285 70 285 65 181 51 285 32 285 48 176 34 132Z"/>
        <path className="heat-area" style={area("chest")} d="M51 57 Q70 47 89 57 L86 91 Q70 101 54 91Z"><title>Chest: {values.chest ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("shoulders")} d="M35 54 Q44 45 54 50 L51 74 37 82 28 70Z M86 50 Q97 45 105 54 L112 70 102 82 89 74Z"><title>Shoulders: {values.shoulders ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("biceps")} d="M29 79 43 84 37 126 24 121Z M97 84 111 79 116 121 103 126Z"><title>Biceps: {values.biceps ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("abs")} d="M57 97 83 97 86 150 54 150Z"><title>Abs: {values.abs ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("quads")} d="M48 157 66 158 62 222 39 222Z M74 158 92 157 101 222 78 222Z"><title>Quads: {values.quads ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("calves")} d="M39 227 61 227 57 281 35 281Z M79 227 101 227 105 281 83 281Z"><title>Calves: {values.calves ?? 0} of 15 sets</title></path>
      </svg></div>
      <div><span>Back</span><svg viewBox="0 0 140 300" role="img" aria-label="Back muscle exposure">
        <circle className="body-outline" cx="70" cy="24" r="17"/><path className="body-outline" d="M48 47 Q70 38 92 47 L106 132 92 176 89 285 70 285 65 181 51 285 32 285 48 176 34 132Z"/>
        <path className="heat-area" style={area("back")} d="M49 56 Q70 46 91 56 L87 117 70 139 53 117Z"><title>Back: {values.back ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("triceps")} d="M29 76 43 82 38 126 24 119Z M97 82 111 76 116 119 102 126Z"><title>Triceps: {values.triceps ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("glutes")} d="M50 140 Q70 129 90 140 L92 170 Q70 181 48 170Z"><title>Glutes: {values.glutes ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("hamstrings")} d="M48 174 66 175 62 225 39 222Z M74 175 92 174 101 222 78 225Z"><title>Hamstrings: {values.hamstrings ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("calves")} d="M39 227 61 227 57 281 35 281Z M79 227 101 227 105 281 83 281Z"><title>Calves: {values.calves ?? 0} of 15 sets</title></path>
      </svg></div>
    </div>
  );
}

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
  const currentWeek = Math.max(1, Math.min(12, Math.ceil((highestSequence + (highestSequence < 60 ? 1 : 0)) / 5)));
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
        <MuscleHeatMap values={displayed} />
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
