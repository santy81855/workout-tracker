import { ProgressDashboard } from "@/components/progress-dashboard";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function ProgressPage() {
  return (
    <main className="app-shell">
      <header className="topbar"><div><p className="eyebrow">Performance trends</p><h1>Progress</h1></div></header>
      <ProgressDashboard />
      <BottomNavigation />
    </main>
  );
}
