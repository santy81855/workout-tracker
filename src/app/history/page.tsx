import { HistoryList } from "@/components/history-list";
import Link from "next/link";

export default function HistoryPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">Completed training</p><h1>History</h1></div>
      </header>
      <HistoryList />
      <nav className="bottom-nav" aria-label="Primary navigation">
        <Link href="/">Today</Link><Link href="/program">Program</Link>
        <Link aria-current="page" href="/history">History</Link><Link href="/progress">Progress</Link>
      </nav>
    </main>
  );
}
