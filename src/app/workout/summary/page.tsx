import { WorkoutSummary } from "@/components/workout-summary";
import { Suspense } from "react";

export default function WorkoutSummaryPage() {
  return (
    <Suspense fallback={<main className="auth-shell"><p>Loading workout summary…</p></main>}>
      <WorkoutSummary />
    </Suspense>
  );
}
