import { ProgressDashboard } from "@/components/progress-dashboard";
import Link from "next/link";

export default function ProgressPage() {
  return (
    <main className="app-shell">
      <header className="topbar"><div><p className="eyebrow">Performance trends</p><h1>Progress</h1></div></header>
      <ProgressDashboard />
      <nav className="bottom-nav" aria-label="Primary navigation">
        <Link href="/">Today</Link><Link href="/program">Program</Link><Link href="/history">History</Link>
        <Link aria-current="page" href="/progress">Progress</Link>
      </nav>
    </main>
  );
}
