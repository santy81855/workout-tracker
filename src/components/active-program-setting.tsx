"use client";

import { useActiveProgram } from "@/lib/program/use-active-program";

export function ActiveProgramSetting() {
  const { document, startsOn, hasProgram, loading } = useActiveProgram();
  return <div><span>Active cycle</span><strong>{loading ? "Loading…" : hasProgram ? `${document.name} · ${new Date(`${startsOn}T12:00:00`).toLocaleDateString()}` : "No plan selected"}</strong></div>;
}
