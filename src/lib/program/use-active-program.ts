"use client";

import { useEffect, useState } from "react";
import { clearActiveProgramRecord, defaultProgram, getActiveProgramRecord, saveActiveProgramRecord, type ActiveProgramRecord } from "./active-program";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { programDocumentSchema } from "./schema";

export function useActiveProgram() {
  const [record, setRecord] = useState<ActiveProgramRecord | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void getActiveProgramRecord().then(async (cached) => {
      try {
        const { data, error } = await createSupabaseBrowserClient().rpc("get_program_library");
        if (error) throw error;
        const active = (data as Array<{ status: string; startsOn: string; document: unknown }> | null)?.find((cycle) => cycle.status === "active");
        if (!active) { await clearActiveProgramRecord(); setRecord(null); return; }
        const next = { document: programDocumentSchema.parse(active.document), startsOn: active.startsOn, activatedAt: new Date().toISOString() };
        await saveActiveProgramRecord(next); setRecord(next);
      } catch { setRecord(cached); }
    }).finally(() => setLoading(false));
  }, []);
  return { document: record?.document ?? defaultProgram, startsOn: record?.startsOn ?? "", activatedAt: record?.activatedAt ?? "", hasProgram: record !== null, loading, setRecord };
}
