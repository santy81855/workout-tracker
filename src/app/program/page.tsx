"use client";

import { useActiveProgram } from "@/lib/program/use-active-program";
import { BottomNavigation } from "@/components/bottom-navigation";
import { PlanLibrary } from "@/components/plan-library";

export default function ProgramPage() {
  const { document: program, hasProgram, loading } = useActiveProgram();
  const exerciseNames = new Map(program.exercises.map((exercise) => [exercise.slug, exercise.name]));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Twelve-week cycle</p>
          <h1>Program</h1>
        </div>
      </header>

      <PlanLibrary showStarter={!loading && !hasProgram} />

      {!hasProgram ? null : <>

      <section className="hero-card program-intro">
        <p className="eyebrow">Active plan</p>
        <h2>{program.displayTitle ?? program.name}</h2>
        {program.displayTitle ? <p className="program-formal-name">{program.name}</p> : null}
        <p className="muted-copy">{program.description}</p>
        <div className="program-summary" aria-label="Program summary">
          <span><strong>{program.weekCount}</strong> weeks</span>
          <span><strong>{program.workoutsPerWeek}</strong> workouts per week</span>
          <span><strong>60</strong> total sessions</span>
        </div>
        {program.splitType ? <span className="split-type-pill">{program.splitType}</span> : null}
      </section>

      <section className="program-section" aria-labelledby="week-progression-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Volume and effort</p>
            <h2 id="week-progression-title">Week progression</h2>
          </div>
        </div>
        <div className="week-grid">
          {program.weekRules.map((week) => (
            <article className="week-card" key={week.week}>
              <div>
                <span className="week-number">W{week.week}</span>
                <p>{week.phase}{week.isDeload ? " · Deload" : ""}</p>
              </div>
              <strong>{week.targetRir.min === week.targetRir.max ? week.targetRir.min : `${week.targetRir.min}–${week.targetRir.max}`} RIR</strong>
              <small>
                {week.setRules.peak4.required} / {week.setRules.peak3.required}{week.setRules.peak3.optional ? "+1" : ""} / {week.setRules.peak2.required} sets
              </small>
            </article>
          ))}
        </div>
        <p className="legend-copy">Set counts are shown for exercises that peak at 4 / 3 / 2 sets.</p>
      </section>

      <section className="program-section" aria-labelledby="training-days-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ordered queue</p>
            <h2 id="training-days-title">Training days</h2>
          </div>
        </div>
        <div className="template-list">
          {program.workoutTemplates.map((template) => (
            <article className="template-card" key={template.sequence}>
              <header>
                <span className="template-sequence">{template.sequence}</span>
                <div>
                  <p className="template-day">Originally {template.originalDayLabel}</p>
                  <h3>{template.name}</h3>
                </div>
              </header>
              <ol>
                {template.exercises.map((prescription) => (
                  <li key={prescription.exercise}>
                    <span>{exerciseNames.get(prescription.exercise)}</span>
                    <small>{prescription.repMin}–{prescription.repMax} reps · peak {prescription.peakSets}</small>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      </>}
      <BottomNavigation />
    </main>
  );
}
