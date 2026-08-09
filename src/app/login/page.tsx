import { getSupabasePublicConfig } from "@/lib/supabase/config";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const isConfigured = Boolean(getSupabasePublicConfig());

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Private access</p>
        <h1>Welcome back</h1>
        <p className="muted-copy auth-copy">Sign in to access your training data.</p>
        {!isConfigured ? (
          <div className="demo-notice">
            <strong>Local demo mode</strong>
            <p>Supabase has not been connected, so authentication cannot complete yet.</p>
          </div>
        ) : null}
        <LoginForm />
        {!isConfigured ? <Link className="text-link" href="/">Return to the local preview</Link> : null}
      </section>
    </main>
  );
}
