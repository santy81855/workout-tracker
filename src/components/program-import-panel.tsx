"use client";

import { saveActiveProgramRecord } from "@/lib/program/active-program";
import { programDocumentSchema, type ProgramDocument } from "@/lib/program/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { useRouter } from "next/navigation";
import { useState } from "react";

function upcomingMonday() {
  const date = new Date();
  const days = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ProgramImportPanel() {
  const router = useRouter();
  const [document, setDocument] = useState<ProgramDocument | null>(null);
  const [startsOn, setStartsOn] = useState(upcomingMonday);
  const [message, setMessage] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function readFile(file: File | undefined) {
    setDocument(null); setMessage(null);
    if (!file) return;
    if (file.size > 1_000_000) { setMessage("Program files must be smaller than 1 MB."); return; }
    try {
      const raw: unknown = JSON.parse(await file.text());
      const parsed = programDocumentSchema.safeParse(raw);
      if (!parsed.success) {
        const firstIssues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "document"}: ${issue.message}`);
        setMessage(`Invalid program: ${firstIssues.join(" · ")}`);
        return;
      }
      setDocument(parsed.data);
      setMessage("Program structure is valid. Review the summary before activation.");
    } catch {
      setMessage("This file is not valid JSON.");
    }
  }

  async function activate() {
    if (!document) return;
    setActivating(true); setMessage(null);
    try {
      const start = new Date(`${startsOn}T12:00:00`);
      if (start.getDay() !== 1) throw new Error("Choose a Monday start date.");
      if (await workoutRepository.getActiveSession()) throw new Error("Finish the active workout before changing cycles.");
      if ((await workoutRepository.listOutbox()).length > 0) throw new Error("Wait for pending workout changes to sync before changing cycles.");
      const { error } = await createSupabaseBrowserClient().rpc("activate_program_cycle", { p_document: document, p_starts_on: startsOn });
      if (error) throw new Error(error.message);
      await saveActiveProgramRecord({ document, startsOn, activatedAt: new Date().toISOString() });
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The program could not be activated.");
      setActivating(false);
    }
  }

  async function saveForLater() {
    if (!document) return;
    setSaving(true); setMessage(null);
    try {
      const { error } = await createSupabaseBrowserClient().rpc("save_program_to_library", { p_document: document, p_starts_on: startsOn });
      if (error) throw new Error(error.message);
      setMessage("Plan added to your library. Your current plan is still active.");
      setDocument(null);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "The plan could not be saved."); }
    finally { setSaving(false); }
  }

  return (
    <section className="settings-section program-import-panel">
      <p className="eyebrow">Future cycle</p><h2>Import program JSON</h2>
      <p className="muted-copy">Activation pauses the current cycle and preserves its progress so you can resume it later. Use the example JSON export as the authoring contract.</p>
      <label className="file-picker">Choose JSON file<input accept="application/json,.json" onChange={(event) => void readFile(event.target.files?.[0])} type="file" /></label>
      {document ? (
        <div className="program-import-preview">
          <strong>{document.name}</strong><span>{document.weekCount} weeks · {document.workoutsPerWeek * document.weekCount} workouts · {document.exercises.length} exercises</span>
          <ol>{document.workoutTemplates.map((template) => <li key={template.sequence}>{template.name} <small>{template.exercises.length} exercises</small></li>)}</ol>
          <label>Cycle starts<input min={upcomingMonday()} onChange={(event) => setStartsOn(event.target.value)} type="date" value={startsOn} /></label>
          <button className="primary-button" disabled={activating || saving} onClick={activate} type="button">{activating ? "Activating…" : "Pause Current Plan and Activate"}</button>
          <button className="secondary-button" disabled={activating || saving} onClick={saveForLater} type="button">{saving ? "Adding…" : "Add to Library for Later"}</button>
        </div>
      ) : null}
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </section>
  );
}
