import { getSupabasePublicConfig } from "@/lib/supabase/config";
import Link from "next/link";
import { AuthPanel } from "./auth-panel";

export default function LoginPage() {
  const isConfigured = Boolean(getSupabasePublicConfig());

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <AuthPanel />
        {!isConfigured ? (
          <div className="demo-notice">
            <strong>Local demo mode</strong>
            <p>Supabase has not been connected, so authentication cannot complete yet.</p>
          </div>
        ) : null}
        {!isConfigured ? <Link className="text-link" href="/">Return to the local preview</Link> : null}
      </section>
    </main>
  );
}
