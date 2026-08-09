"use client";

import { BottomNavigation } from "@/components/bottom-navigation";
import { useActiveProgram } from "@/lib/program/use-active-program";
import Link from "next/link";

export default function ExercisesPage() {
  const { document: program } = useActiveProgram();
  return (
    <main className="app-shell">
      <header className="topbar"><div><p className="eyebrow">Reference</p><h1>Exercises</h1></div><Link className="text-link settings-done" href="/program">Done</Link></header>
      <div className="exercise-library-list">
        {program.exercises.map((exercise) => {
          return <details key={exercise.slug}>
            <summary><div><strong>{exercise.name}</strong><small>{exercise.equipment} · {exercise.defaultRestSeconds / 60} min rest</small></div><span>+</span></summary>
            <div className="exercise-library-detail">
              <p><strong>Muscles:</strong> {exercise.muscles.map((muscle) => `${muscle.muscle}${muscle.contribution === .5 ? " (secondary)" : ""}`).join(", ")}</p>
              {exercise.guidance.length ? <><strong>Plan guidance</strong><ul>{exercise.guidance.map((guide) => <li key={guide}>{guide}</li>)}</ul></> : null}
            </div>
          </details>;
        })}
      </div>
      <BottomNavigation />
    </main>
  );
}
