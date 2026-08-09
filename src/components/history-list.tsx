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
  const [view, setView] = useState<"list" | "calendar">("list");

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

  const monthDate = sessions[0] ? new Date(sessions[0].startedAt) : new Date();
  const year = monthDate.getFullYear(); const month = monthDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate(); const offset = new Date(year, month, 1).getDay();
  const byDay = new Map<number, ActiveWorkoutSession[]>();
  for (const session of sessions) { const date = new Date(session.startedAt); if (date.getFullYear() === year && date.getMonth() === month) byDay.set(date.getDate(), [...(byDay.get(date.getDate()) ?? []), session]); }

  return (<>
    <div className="segmented-control history-view-toggle"><button aria-pressed={view === "list"} onClick={() => setView("list")} type="button">List</button><button aria-pressed={view === "calendar"} onClick={() => setView("calendar")} type="button">Calendar</button></div>
    {view === "calendar" ? <section className="history-calendar"><header><h2>{monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></header><div className="calendar-weekdays">{["S","M","T","W","T","F","S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-grid">{Array.from({ length: offset }, (_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const entries = byDay.get(day) ?? []; return <div className={entries.length ? "calendar-day calendar-day-trained" : "calendar-day"} key={day}><span>{day}</span>{entries.map((session) => <Link aria-label={`${session.templateName} on day ${day}`} href={session.status === "active" ? "/workout" : `/workout/summary?session=${session.id}`} key={session.id} title={session.templateName} />)}</div>; })}</div><p className="legend-copy">Colored dots mark recorded workouts. Select one to open its summary.</p></section> :
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
    </div>}
  </>);
}
