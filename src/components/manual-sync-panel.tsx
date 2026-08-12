"use client";

import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { flushWorkoutOutbox, getLastWorkoutSyncErrors } from "@/lib/workout/sync";
import { useState } from "react";

export function ManualSyncPanel() {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  async function syncNow() {
    setSyncing(true);
    setMessage(null);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const before = await workoutRepository.listOutbox();
      await flushWorkoutOutbox();
      const remaining = await workoutRepository.listOutbox();
      if (remaining.length > 0) {
        const details = getLastWorkoutSyncErrors();
        setMessageKind("error");
        setMessage(details.length > 0 ? details.map((item) => `${item.workout}: ${item.message}`).join(" ") : `${remaining.length} workout change${remaining.length === 1 ? " is" : "s are"} still waiting.`);
      }
      else { setMessageKind("success"); setMessage(before.length > 0 ? `Synced ${before.length} workout change${before.length === 1 ? "" : "s"} to your account.` : "Everything stored on this device is already synced."); }
    } catch {
      setMessageKind("error");
      setMessage("Sync could not finish. Your changes remain safely stored on this device.");
    } finally {
      setSyncing(false);
    }
  }

  return <section className="settings-section sync-panel">
    <p className="eyebrow">Across your devices</p>
    <h2>Sync workout data</h2>
    <p className="muted-copy">Push any workout changes waiting on this device to your account before opening the app somewhere else.</p>
    <button className="primary-button" disabled={syncing} onClick={() => void syncNow()} type="button">{syncing ? "Syncing…" : "Sync Now"}</button>
    {message ? <p className={`sync-message form-message-${messageKind}`} role="status">{message}</p> : null}
  </section>;
}
