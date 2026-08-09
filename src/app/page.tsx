import { TodayDashboard } from "@/components/today-dashboard";
import Link from "next/link";

export default function TodayPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Your next workout</p>
          <h1>Today</h1>
        </div>
        <Link className="icon-button" href="/settings" aria-label="Open settings">
          <span aria-hidden="true">⚙</span>
        </Link>
      </header>

      <TodayDashboard />

      <nav className="bottom-nav" aria-label="Primary navigation">
        <Link aria-current="page" href="/">Today</Link>
        <Link href="/program">Program</Link>
        <Link href="/history">History</Link>
        <Link href="/progress">Progress</Link>
      </nav>
    </main>
  );
}
