import { TodayDashboard } from "@/components/today-dashboard";
import Link from "next/link";
import { BottomNavigation } from "@/components/bottom-navigation";

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

      <BottomNavigation />
    </main>
  );
}
