"use client";

import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { flushWorkoutOutbox } from "@/lib/workout/sync";
import { useState } from "react";

export function ManualSyncPanel() {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function syncNow() {
    setSyncing(true);
    setMessage(null);
    try {
      const before = await workoutRepository.listOutbox();
      await flushWorkoutOutbox();
      const remaining = await workoutRepository.listOutbox();
      if (remaining.length > 0) setMessage(`${remaining.length} workout change${remaining.length === 1 ? " is" : "s are"} still waiting. Check your connection or resolve any workout conflict.`);
      else if (before.length > 0) setMessage(`Synced ${before.length} workout change${before.length === 1 ? "" : "s"} to your account.`);
      else setMessage("Everything stored on this device is already synced.");
    } catch {
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
    {message ? <p className="sync-message" role="status">{message}</p> : null}
  </section>;
}
