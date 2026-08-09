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
  return (
    <>
      <section className="record-grid exercise-record-grid" aria-label={`${stat.name} records`}>
        <div><span>Highest weight</span><strong>{stat.highestLoadTenthsLb === null ? "—" : `${stat.highestLoadTenthsLb / 10} lb`}</strong><small>{stat.highestLoadMode ? loadLabel(stat.highestLoadMode) : "No weighted sets"}</small></div>
        <div><span>Best set volume</span><strong>{stat.bestSetVolumeTenths === null ? "—" : (stat.bestSetVolumeTenths / 10).toLocaleString()}</strong><small>entered weight × reps</small></div>
        <div><span>Most reps</span><strong>{stat.mostReps}</strong><small>one completed set</small></div>
        <div><span>Completed sets</span><strong>{stat.completedSets}</strong><small>across {stat.sessions} sessions</small></div>
      </section>
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
