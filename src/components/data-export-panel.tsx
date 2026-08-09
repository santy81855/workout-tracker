"use client";

import { buildCompleteExport, currentProgramTemplate, downloadText, sessionsToCsv } from "@/lib/export/user-data";
import { listAvailableSessions } from "@/lib/workout/history";
import { useState } from "react";

export function DataExportPanel() {
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function completeJson() {
    setWorking("json"); setMessage(null);
    try {
      const payload = await buildCompleteExport();
      downloadText(`workout-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
      setMessage("Complete JSON export created.");
    } catch { setMessage("The export could not be created."); }
    finally { setWorking(null); }
  }

  async function workoutCsv() {
    setWorking("csv"); setMessage(null);
    try {
      const sessions = await listAvailableSessions();
      downloadText(`workout-sets-${new Date().toISOString().slice(0, 10)}.csv`, sessionsToCsv(sessions), "text/csv;charset=utf-8");
      setMessage("Set-level CSV export created.");
    } catch { setMessage("The export could not be created."); }
    finally { setWorking(null); }
  }

  function templateJson() {
    downloadText("workout-program-template.example.json", JSON.stringify(currentProgramTemplate(), null, 2), "application/json");
    setMessage("Program template exported. An agent can edit this documented structure for a future cycle.");
  }

  return (
    <section className="settings-section export-panel">
      <p className="eyebrow">Data ownership</p>
      <h2>Export your data</h2>
      <p className="muted-copy">Exports may contain sensitive health and workout information. Store downloaded files privately.</p>
      <button className="secondary-button" disabled={working !== null} onClick={completeJson} type="button">{working === "json" ? "Preparing…" : "Complete JSON Export"}</button>
      <button className="secondary-button" disabled={working !== null} onClick={workoutCsv} type="button">{working === "csv" ? "Preparing…" : "Workout Sets CSV"}</button>
      <button className="secondary-button" disabled={working !== null} onClick={templateJson} type="button">Example Program JSON</button>
      {message ? <p className="form-message" role="status">{message}</p> : null}
    </section>
  );
}
