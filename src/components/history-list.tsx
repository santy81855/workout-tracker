"use client";

import { listAvailableSessions } from "@/lib/workout/history";
import type { ActiveWorkoutSession } from "@/lib/workout/types";
import Link from "next/link";
import { useEffect, useState } from "react";

function sessionMetrics(session: ActiveWorkoutSession) {
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets).filter((set) => set.status === "completed");
  return {
    exercises: session.exercises.filter((exercise) => exercise.sets.some((set) => set.status === "completed")).length,
    sets: completedSets.length,
    reps: completedSets.reduce((total, set) => total + set.reps, 0),
  };
}

export function HistoryList() {
  const [sessions, setSessions] = useState<ActiveWorkoutSession[] | null>(null);

  useEffect(() => {
    void listAvailableSessions().then(setSessions);
  }, []);

  if (sessions === null) return <p className="muted-copy list-status">Loading history…</p>;
  if (sessions.length === 0) {
    return (
      <section className="empty-card">
        <strong>No workouts recorded yet</strong>
        <p>Complete your first locally saved workout and it will appear here.</p>
        <Link className="primary-link" href="/">Go to Today</Link>
      </section>
    );
  }

  return (
    <div className="history-list">
      {sessions.map((session) => {
        const metrics = sessionMetrics(session);
        const destination = session.status === "active" ? "/workout" : `/workout/summary?session=${session.id}`;
        return (
          <Link className="history-card" href={destination} key={session.id}>
            <div className="history-card-heading">
              <div>
                <p className="eyebrow">Week {session.programWeek} · {session.phase}</p>
                <h2>{session.templateName}</h2>
              </div>
              <span className={`history-status history-status-${session.status}`}>{session.status}</span>
            </div>
            <p className="history-date">
              {new Date(session.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <div className="history-metrics">
              <span><strong>{metrics.exercises}</strong> exercises</span>
              <span><strong>{metrics.sets}</strong> sets</span>
              <span><strong>{metrics.reps}</strong> reps</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
