"use client";

import { calculateExerciseStats } from "@/lib/analytics/exercise-stats";
import { listAvailableSessions } from "@/lib/workout/history";
import type { ActiveWorkoutSession } from "@/lib/workout/types";
import { useEffect, useState } from "react";

function loadLabel(mode: string) {
  if (mode === "per_dumbbell") return "lb each";
  if (mode === "added_bodyweight") return "lb added";
  if (mode === "bodyweight_only") return "bodyweight";
  return "lb total";
}

export function ExerciseHistoryDetail({ slug }: { slug: string }) {
  const [sessions, setSessions] = useState<ActiveWorkoutSession[] | null>(null);
  useEffect(() => { void listAvailableSessions().then(setSessions); }, []);
  if (!sessions) return <p className="muted-copy list-status">Loading exercise history…</p>;

  const completed = sessions.filter((session) => session.status !== "active");
  const stat = calculateExerciseStats(completed).find((item) => item.slug === slug);
  const occurrences = completed.flatMap((session) => session.exercises
    .filter((exercise) => exercise.performedExerciseSlug === slug && exercise.sets.some((set) => set.status === "completed"))
    .map((exercise) => ({ session, exercise })))
    .sort((left, right) => new Date(right.session.startedAt).valueOf() - new Date(left.session.startedAt).valueOf());

  if (!stat) return <section className="empty-card"><strong>No completed sets</strong><p>This exercise has no saved history yet.</p></section>;
  const chartPoints = [...occurrences].reverse().map(({ session, exercise }) => {
    const weighted = exercise.sets.filter((set) => set.status === "completed" && set.loadTenthsLb !== null);
    return { date: session.startedAt, load: Math.max(...weighted.map((set) => (set.loadTenthsLb ?? 0) / 10), 0), volume: Math.max(...weighted.map((set) => ((set.loadTenthsLb ?? 0) * set.reps) / 10), 0) };
  }).filter((point) => point.load > 0);
  const path = (key: "load" | "volume") => { const max = Math.max(...chartPoints.map((point) => point[key]), 1); return chartPoints.map((point, index) => `${chartPoints.length === 1 ? 50 : (index / (chartPoints.length - 1)) * 100},${92 - (point[key] / max) * 82}`).join(" "); };
  return (
    <>
      <section className="record-grid exercise-record-grid" aria-label={`${stat.name} records`}>
        <div><span>Highest weight</span><strong>{stat.highestLoadTenthsLb === null ? "—" : `${stat.highestLoadTenthsLb / 10} lb`}</strong><small>{stat.highestLoadMode ? loadLabel(stat.highestLoadMode) : "No weighted sets"}</small></div>
        <div><span>Best set volume</span><strong>{stat.bestSetVolumeTenths === null ? "—" : (stat.bestSetVolumeTenths / 10).toLocaleString()}</strong><small>entered weight × reps</small></div>
        <div><span>Most reps</span><strong>{stat.mostReps}</strong><small>one completed set</small></div>
        <div><span>Completed sets</span><strong>{stat.completedSets}</strong><small>across {stat.sessions} sessions</small></div>
      </section>
      <section className="program-section exercise-chart-section"><div className="section-heading"><div><p className="eyebrow">Over time</p><h2>Performance chart</h2></div></div>{chartPoints.length ? <><svg aria-label="Highest weight and best set volume by workout" preserveAspectRatio="none" role="img" viewBox="0 0 100 100"><polyline className="chart-load" points={path("load")} /><polyline className="chart-volume" points={path("volume")} /></svg><div className="chart-legend"><span><i className="chart-load-key" />Highest weight</span><span><i className="chart-volume-key" />Best set volume</span></div></> : <p className="muted-copy list-status">Weighted sets will appear here after they are completed.</p>}</section>
      <section className="program-section">
        <div className="section-heading"><div><p className="eyebrow">Set by set</p><h2>History</h2></div></div>
        <div className="exercise-occurrence-list">
          {occurrences.map(({ session, exercise }) => (
            <article key={`${session.id}-${exercise.id}`}>
              <header><div><strong>{new Date(session.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong><small>Week {session.programWeek} · {session.templateName}</small></div></header>
              <ol>{exercise.sets.filter((set) => set.status === "completed").map((set) => <li key={set.id}><span>Set {set.setNumber}</span><strong>{set.loadMode === "bodyweight_only" ? "Bodyweight" : `${(set.loadTenthsLb ?? 0) / 10} ${loadLabel(set.loadMode)}`} × {set.reps}</strong><small>{set.rirOnTarget ? "RIR on target" : set.actualRir === null ? "RIR not recorded" : `${set.actualRir} RIR`}</small></li>)}</ol>
            </article>
          ))}
        </div>
        <p className="legend-copy">Set volume uses the entered load only. Dumbbell values remain per dumbbell, and weighted pull-ups use added weight; compare trends within the same exercise and load mode.</p>
      </section>
    </>
  );
}
