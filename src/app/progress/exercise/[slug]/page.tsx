import { ExerciseHistoryDetail } from "@/components/exercise-history-detail";
import Link from "next/link";
import { BottomNavigation } from "@/components/bottom-navigation";

export default async function ExerciseProgressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <main className="app-shell">
      <header className="topbar"><div><p className="eyebrow">Exercise progress</p><h1>{decodeURIComponent(slug).split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}</h1></div><Link className="text-link settings-done" href="/progress">Done</Link></header>
      <ExerciseHistoryDetail slug={decodeURIComponent(slug)} />
      <BottomNavigation />
    </main>
  );
}
