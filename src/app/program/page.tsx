"use client";

import { BottomNavigation } from "@/components/bottom-navigation";
import { ProgramBrowser } from "@/components/program-browser";

export default function ProgramPage() {
  return (
    <main className="app-shell">
      <ProgramBrowser />
      <BottomNavigation />
    </main>
  );
}
