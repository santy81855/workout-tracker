"use client";

import { useActiveProgram } from "@/lib/program/use-active-program";

export function ActiveProgramSetting() {
  const { document, startsOn } = useActiveProgram();
  return <div><span>Active cycle</span><strong>{document.name} · {new Date(`${startsOn}T12:00:00`).toLocaleDateString()}</strong></div>;
}
