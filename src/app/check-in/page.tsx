import { WeeklyCheckinForm } from "@/components/weekly-checkin-form";
import Link from "next/link";
import { Suspense } from "react";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function WeeklyCheckinPage() {
  return (
    <main className="app-shell">
      <header className="topbar"><div><p className="eyebrow">End-of-week review</p><h1>Check-in</h1></div><Link className="text-link" href="/">Close</Link></header>
      <Suspense fallback={<p className="muted-copy">Loading review…</p>}><WeeklyCheckinForm /></Suspense>
      <BottomNavigation />
    </main>
  );
}
