import { HistoryList } from "@/components/history-list";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function HistoryPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">Completed training</p><h1>History</h1></div>
      </header>
      <HistoryList />
      <BottomNavigation />
    </main>
  );
}
