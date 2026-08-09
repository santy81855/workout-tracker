"use client";

import { useEffect, useState } from "react";
import { defaultProgram, getActiveProgramRecord, type ActiveProgramRecord } from "./active-program";

export function useActiveProgram() {
  const [record, setRecord] = useState<ActiveProgramRecord>({
    document: defaultProgram,
    startsOn: "2026-08-10",
    activatedAt: "2026-08-08T00:00:00.000Z",
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => { void getActiveProgramRecord().then(setRecord).finally(() => setLoading(false)); }, []);
  return { ...record, loading, setRecord };
}
