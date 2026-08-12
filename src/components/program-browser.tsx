"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProgramImportPanel } from "@/components/program-import-panel";
import { PlanLibrary } from "@/components/plan-library";
import { saveActiveProgramRecord } from "@/lib/program/active-program";
import { programDocumentSchema, type ProgramDocument } from "@/lib/program/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { downloadText } from "@/lib/export/user-data";
import { workoutRepository } from "@/lib/workout/indexeddb-repository";

interface LibraryCycle {
  cycleId: string;
  status: "active" | "planned" | "completed" | "abandoned";
  startsOn: string;
  completedAt: string | null;
  document: ProgramDocument;
  completedSessions: number;
}

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.valueOf() - offset).toISOString().slice(0, 10);
}

function restLabel(seconds: number) {
  if (seconds % 60 === 0) return `${seconds / 60} min rest`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} rest`;
}

function cycleLabel(cycle: LibraryCycle) {
  if (cycle.status === "active") return "Active plan";
  if (cycle.status === "completed") return "Completed plan";
  return cycle.completedSessions > 0 ? "Paused plan" : "Saved plan";
}

export function ProgramBrowser() {
  const carousel = useRef<HTMLDivElement>(null);
  const [cycles, setCycles] = useState<LibraryCycle[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restartDate, setRestartDate] = useState(today);

  async function loadLibrary(preferredCycleId?: string) {
    const { data, error } = await createSupabaseBrowserClient().rpc("get_program_library");
    if (error) { setMessage(error.message); setCycles([]); return; }
    const parsed = ((data as Array<Omit<LibraryCycle, "document"> & { document: unknown }> | null) ?? []).map((cycle) => ({
      ...cycle,
      document: programDocumentSchema.parse(cycle.document),
    })).sort((left, right) => Number(right.status === "active") - Number(left.status === "active"));
    setCycles(parsed);
    const index = preferredCycleId ? parsed.findIndex((cycle) => cycle.cycleId === preferredCycleId) : 0;
    setSelectedIndex(index >= 0 ? index : 0);
  }

  useEffect(() => {
    let current = true;
    void createSupabaseBrowserClient().rpc("get_program_library").then(({ data, error }) => {
      if (!current) return;
      if (error) { setMessage(error.message); setCycles([]); return; }
      const parsed = ((data as Array<Omit<LibraryCycle, "document"> & { document: unknown }> | null) ?? []).map((cycle) => ({
        ...cycle,
        document: programDocumentSchema.parse(cycle.document),
      })).sort((left, right) => Number(right.status === "active") - Number(left.status === "active"));
      setCycles(parsed);
    });
    return () => { current = false; };
  }, []);

  const selected = cycles?.[selectedIndex] ?? null;
  const program = selected?.document ?? null;
  const exerciseNames = new Map(program?.exercises.map((exercise) => [exercise.slug, exercise.name]) ?? []);

  function updateVisibleCard() {
    const node = carousel.current;
    if (!node || !cycles?.length) return;
    const cards = Array.from(node.children) as HTMLElement[];
    const nextIndex = cards.reduce((nearest, card, index) =>
      Math.abs(card.offsetLeft - node.offsetLeft - node.scrollLeft) < Math.abs(cards[nearest].offsetLeft - node.offsetLeft - node.scrollLeft) ? index : nearest
    , 0);
    setSelectedIndex(nextIndex);
    setConfirmRemove(false); setConfirmRestart(false); setMessage(null);
  }

  function scrollToPlan(index: number) {
    const node = carousel.current;
    const card = node?.children.item(index) as HTMLElement | null;
    if (node && card) node.scrollTo({ left: card.offsetLeft - node.offsetLeft, behavior: "smooth" });
    setSelectedIndex(index);
  }

  async function ensureCanSwitch() {
    if (await workoutRepository.getActiveSession()) throw new Error("Finish or cancel the active workout before changing plans.");
    if ((await workoutRepository.listOutbox()).length > 0) throw new Error("Sync pending workout changes before changing plans.");
  }

  async function resume() {
    if (!selected) return;
    setPending("resume"); setMessage(null);
    try {
      await ensureCanSwitch();
      const { error } = await createSupabaseBrowserClient().rpc("resume_program_cycle", { p_cycle_id: selected.cycleId });
      if (error) throw new Error(error.message);
      await saveActiveProgramRecord({ document: selected.document, startsOn: selected.startsOn, activatedAt: new Date().toISOString() });
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The plan could not be started."); setPending(null); }
  }

  async function restart() {
    if (!selected || !restartDate) return;
    setPending("restart"); setMessage(null);
    try {
      await ensureCanSwitch();
      const { error } = await createSupabaseBrowserClient().rpc("activate_program_cycle", { p_document: selected.document, p_starts_on: restartDate });
      if (error) throw new Error(error.message);
      await saveActiveProgramRecord({ document: selected.document, startsOn: restartDate, activatedAt: new Date().toISOString() });
      window.location.reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The plan could not be restarted."); setPending(null); }
  }

  async function remove() {
    if (!selected) return;
    setPending("remove"); setMessage(null);
    const requiresConfirmation = selected.status === "active" || selected.completedSessions > 0;
    const { error } = await createSupabaseBrowserClient().rpc("remove_program_cycle", { p_cycle_id: selected.cycleId, p_confirm_in_progress: requiresConfirmation });
    if (error) { setMessage(error.message); setPending(null); return; }
    setConfirmRemove(false); setPending(null);
    await loadLibrary();
  }

  function exportSelected() {
    if (selected) downloadText(`${selected.document.slug}.json`, JSON.stringify(selected.document, null, 2), "application/json");
  }

  return <>
    <header className="topbar program-page-header"><div><p className="eyebrow">Training plans</p><h1>Program</h1></div><button className="plan-library-import-button" onClick={() => setShowImport((shown) => !shown)} type="button">{showImport ? "Close" : "+ Import"}</button></header>
    {showImport ? <ProgramImportPanel onComplete={() => { setShowImport(false); void loadLibrary(); }} /> : null}

    {cycles === null ? <section className="hero-card program-browser-loading" aria-busy="true">Loading your plans…</section> : cycles.length === 0 ? <PlanLibrary showStarter /> : <>
      <section className="program-carousel-section" aria-label="Saved plans">
        <div className="program-carousel-actions">
          <span className={`library-status library-status-${selected?.status}`}>{selected ? cycleLabel(selected) : "Plan"}</span>
          <div><button onClick={exportSelected} type="button">Export</button><button className="library-remove-button" onClick={() => setConfirmRemove(true)} type="button">Remove</button></div>
        </div>
        <div className="program-carousel" onScroll={updateVisibleCard} ref={carousel}>
          {cycles.map((cycle) => <article className="hero-card program-carousel-card" key={cycle.cycleId}>
            <p className="eyebrow">{cycleLabel(cycle)}</p><h2>{cycle.document.displayTitle ?? cycle.document.name}</h2>
            {cycle.document.displayTitle ? <p className="program-formal-name">{cycle.document.name}</p> : null}
            <p className="muted-copy">{cycle.document.description}</p>
            <div className="program-summary"><span><strong>{cycle.document.weekCount}</strong> weeks</span><span><strong>{cycle.document.workoutsPerWeek}</strong> per week</span><span><strong>{cycle.completedSessions}</strong> completed</span></div>
            {cycle.document.splitType ? <span className="split-type-pill">{cycle.document.splitType}</span> : null}
          </article>)}
        </div>
        <div className="program-carousel-dots" aria-label={`Plan ${selectedIndex + 1} of ${cycles.length}`}>{cycles.map((cycle, index) => <button aria-label={`Show ${cycle.document.displayTitle ?? cycle.document.name}`} aria-current={index === selectedIndex} key={cycle.cycleId} onClick={() => scrollToPlan(index)} type="button" />)}</div>
        <div className="program-switch-actions" aria-live="polite">
          {selected?.status === "active" ? <span className="active-plan-message">This is your current plan</span> : <>
            {selected?.status === "completed"
              ? <button className="primary-button" disabled={pending !== null} onClick={() => setConfirmRestart(true)} type="button">Start new cycle</button>
              : <button className="primary-button" disabled={pending !== null} onClick={() => void resume()} type="button">{pending === "resume" ? "Starting…" : selected?.completedSessions ? "Resume plan" : "Start plan"}</button>}
            {selected?.status === "planned" && selected.completedSessions > 0 ? <button className="secondary-button" disabled={pending !== null} onClick={() => setConfirmRestart(true)} type="button">Restart from beginning</button> : null}
          </>}
        </div>
        {confirmRestart && selected ? <div className="program-action-confirm" role="alertdialog"><strong>Restart {selected.document.displayTitle ?? selected.document.name}?</strong><p>Your previous workouts remain in History. A separate, fresh cycle will begin at workout one.</p><label>New cycle starts<input min={today()} onChange={(event) => setRestartDate(event.target.value)} type="date" value={restartDate} /></label><div><button onClick={() => setConfirmRestart(false)} type="button">Cancel</button><button className="primary-button" disabled={pending !== null} onClick={() => void restart()} type="button">{pending === "restart" ? "Restarting…" : "Start fresh cycle"}</button></div></div> : null}
        {confirmRemove && selected ? <div className="program-action-confirm" role="alertdialog"><strong>Remove this plan?</strong><p>Completed workout history is preserved, but the plan will leave this carousel.</p><div><button onClick={() => setConfirmRemove(false)} type="button">Keep plan</button><button className="danger-button" disabled={pending !== null} onClick={() => void remove()} type="button">{pending === "remove" ? "Removing…" : "Remove plan"}</button></div></div> : null}
        {message ? <p className="form-message action-error" role="alert">{message}</p> : null}
      </section>

      {program ? <>
        <section className="program-section" aria-labelledby="week-progression-title"><div className="section-heading"><div><p className="eyebrow">{cycleLabel(selected!)}</p><h2 id="week-progression-title">Week progression</h2></div></div><div className="week-grid">{program.weekRules.map((week) => <article className="week-card" key={week.week}><div><span className="week-number">W{week.week}</span><p>{week.phase}{week.isDeload ? " · Deload" : ""}</p></div><strong>{week.targetRir.min === week.targetRir.max ? week.targetRir.min : `${week.targetRir.min}–${week.targetRir.max}`} RIR</strong><small>{week.setRules.peak4.required} / {week.setRules.peak3.required}{week.setRules.peak3.optional ? "+1" : ""} / {week.setRules.peak2.required} sets</small></article>)}</div><p className="legend-copy">Set counts are shown for exercises that peak at 4 / 3 / 2 sets.</p></section>
        <section className="program-section" aria-labelledby="training-days-title"><div className="section-heading"><div><p className="eyebrow">Plan preview</p><h2 id="training-days-title">Training days</h2></div></div><div className="template-list">{program.workoutTemplates.map((template) => <article className="template-card" key={template.sequence}><header><span className="template-sequence">{template.sequence}</span><div><p className="template-day">Originally {template.originalDayLabel}</p><h3>{template.name}</h3></div></header><ol>{template.exercises.map((prescription) => <li key={prescription.exercise}><span>{exerciseNames.get(prescription.exercise)}</span><small>{prescription.repMin}–{prescription.repMax} reps · Up to {prescription.peakSets} working sets · {restLabel(prescription.restSeconds ?? program.exercises.find((item) => item.slug === prescription.exercise)?.defaultRestSeconds ?? 0)}</small></li>)}</ol></article>)}</div></section>
        <Link className="exercise-library-link" href="/exercises"><span><strong>Exercise library</strong><small>Equipment, muscles, rest times, and form reminders</small></span><b>Browse →</b></Link>
      </> : null}
    </>}
  </>;
}
