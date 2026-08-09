"use client";

import { defaultProgram, saveActiveProgramRecord } from "@/lib/program/active-program";
import type { ProgramDocument } from "@/lib/program/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface LibraryCycle { cycleId: string; status: "active" | "planned" | "completed" | "abandoned"; startsOn: string; completedAt: string | null; document: ProgramDocument; completedSessions: number }
function upcomingMonday() { const date = new Date(); const days = ((8 - date.getDay()) % 7) || 7; date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }

export function PlanLibrary({ showStarter = false }: { showStarter?: boolean }) {
  const router = useRouter();
  const [cycles, setCycles] = useState<LibraryCycle[] | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { void createSupabaseBrowserClient().rpc("get_program_library").then(({ data }) => setCycles((data as LibraryCycle[] | null) ?? [])); }, []);

  async function useStarter() {
    setPending("starter"); setMessage(null);
    const startsOn = upcomingMonday();
    const { error } = await createSupabaseBrowserClient().rpc("activate_program_cycle", { p_document: defaultProgram, p_starts_on: startsOn });
    if (error) { setMessage(error.message); setPending(null); return; }
    await saveActiveProgramRecord({ document: defaultProgram, startsOn, activatedAt: new Date().toISOString() });
    router.push("/"); router.refresh();
  }

  async function resume(cycle: LibraryCycle) {
    setPending(cycle.cycleId); setMessage(null);
    const { error } = await createSupabaseBrowserClient().rpc("resume_program_cycle", { p_cycle_id: cycle.cycleId });
    if (error) { setMessage(error.message); setPending(null); return; }
    await saveActiveProgramRecord({ document: cycle.document, startsOn: cycle.startsOn, activatedAt: new Date().toISOString() });
    router.push("/"); router.refresh();
  }

  return <section className="program-section plan-library" aria-labelledby="plan-library-title">
    <div className="section-heading"><div><p className="eyebrow">Your plans</p><h2 id="plan-library-title">Plan library</h2></div></div>
    {showStarter ? <article className="library-plan starter-plan"><div><span className="library-status">Starter plan</span><h3>{defaultProgram.displayTitle ?? defaultProgram.name}</h3><p>{defaultProgram.name} · {defaultProgram.splitType}</p></div><button className="primary-button" disabled={pending !== null} onClick={useStarter} type="button">{pending === "starter" ? "Starting…" : "Use this plan"}</button></article> : null}
    {cycles === null ? <p className="muted-copy list-status">Loading your plans…</p> : cycles.length === 0 && !showStarter ? <p className="muted-copy list-status">No saved plans yet.</p> : <div className="library-list">{cycles.map((cycle) => <article className="library-plan" key={cycle.cycleId}><div><span className={`library-status library-status-${cycle.status}`}>{cycle.status === "planned" ? cycle.completedSessions ? "Paused" : "Saved" : cycle.status}</span><h3>{cycle.document.displayTitle ?? cycle.document.name}</h3><p>{cycle.document.name} · {cycle.completedSessions} of {cycle.document.weekCount * cycle.document.workoutsPerWeek} sessions</p></div>{cycle.status === "planned" ? <button disabled={pending !== null} onClick={() => resume(cycle)} type="button">{pending === cycle.cycleId ? "Starting…" : cycle.completedSessions ? "Resume" : "Start"}</button> : null}</article>)}</div>}
    {message ? <p className="form-message" role="status">{message}</p> : null}
    {showStarter ? <div className="ai-plan-guide"><strong>Want a different plan?</strong><p>Download the example JSON from Settings and give it to an AI assistant along with your schedule, equipment, goals, experience, and limitations. Ask it to preserve the schema exactly, then import the resulting file in Settings. Review any training plan for safety and suitability before using it.</p></div> : null}
  </section>;
}
