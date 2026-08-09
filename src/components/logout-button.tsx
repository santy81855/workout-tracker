"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { workoutRepository } from "@/lib/workout/indexeddb-repository";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearActiveProgramRecord } from "@/lib/program/active-program";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      await workoutRepository.clearAllData();
      await clearActiveProgramRecord();
      if ("caches" in window) {
        await Promise.all((await caches.keys()).map((cacheName) => caches.delete(cacheName)));
      }
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Sign out could not be completed. Your device-local workout data has been cleared.");
      setPending(false);
    }
  }

  return (
    <div>
      <button className="danger-button" disabled={pending} onClick={signOut} type="button">
        {pending ? "Signing out…" : "Sign out on this device"}
      </button>
      {error ? <p className="form-message action-error" role="alert">{error}</p> : null}
    </div>
  );
}
