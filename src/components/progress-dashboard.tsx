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
        <circle className="body-outline" cx="70" cy="25" r="16"/><path className="body-outline" d="M52 46 C44 48 37 54 33 65 C28 81 25 104 22 128 C21 137 28 140 33 132 L43 88 C44 113 47 137 50 153 C44 176 39 207 37 239 L34 286 C34 295 46 296 49 287 L57 238 L66 181 L74 181 L83 238 L91 287 C94 296 106 295 106 286 L103 239 C101 207 96 176 90 153 C93 137 96 113 97 88 L107 132 C112 140 119 137 118 128 C115 104 112 81 107 65 C103 54 96 48 88 46 C79 43 61 43 52 46Z"/>
        <path className="heat-area" style={area("chest")} d="M50 58 C57 51 66 51 69 58 L69 89 C61 94 53 91 48 84 C47 74 47 65 50 58Z M90 58 C83 51 74 51 71 58 L71 89 C79 94 87 91 92 84 C93 74 93 65 90 58Z"><title>Chest: {values.chest ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("shoulders")} d="M48 51 C39 52 34 59 33 70 C34 77 39 80 45 77 C48 70 50 60 48 51Z M92 51 C101 52 106 59 107 70 C106 77 101 80 95 77 C92 70 90 60 92 51Z"><title>Shoulders: {values.shoulders ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("biceps")} d="M34 79 C29 88 28 106 27 121 C29 127 34 128 39 123 L44 83 C41 79 38 78 34 79Z M106 79 C111 88 112 106 113 121 C111 127 106 128 101 123 L96 83 C99 79 102 78 106 79Z"><title>Biceps: {values.biceps ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("abs")} d="M56 96 C61 92 79 92 84 96 L86 142 C79 149 61 149 54 142Z"><title>Abs: {values.abs ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("quads")} d="M50 159 C55 154 64 155 67 161 L63 218 C58 227 46 225 42 218 C42 196 45 174 50 159Z M90 159 C85 154 76 155 73 161 L77 218 C82 227 94 225 98 218 C98 196 95 174 90 159Z"><title>Quads: {values.quads ?? 0} of 15 sets</title></path>
        <path className="heat-area" style={area("calves")} d="M42 228 C48 223 58 225 61 232 L54 279 C51 289 40 289 38 280Z M98 228 C92 223 82 225 79 232 L86 279 C89 289 100 289 102 280Z"><title>Calves: {values.calves ?? 0} of 15 sets</title></path>
      </svg></div>
      <div><span>Back</span><svg viewBox="0 0 140 300" role="img" aria-label="Back muscle exposure">
        <circle className="body-outline" cx="70" cy="25" r="16"/><path className="body-outline" d="M52 46 C44 48 37 54 33 65 C28 81 25 104 22 128 C21 137 28 140 33 132 L43 88 C44 113 47 137 50 153 C44 176 39 207 37 239 L34 286 C34 295 46 296 49 287 L57 238 L66 181 L74 181 L83 238 L91 287 C94 296 106 295 106 286 L103 239 C101 207 96 176 90 153 C93 137 96 113 97 88 L107 132 C112 140 119 137 118 128 C115 104 112 81 107 65 C103 54 96 48 88 46 C79 43 61 43 52 46Z"/>
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
