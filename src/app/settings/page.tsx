import { LogoutButton } from "@/components/logout-button";
import { DataExportPanel } from "@/components/data-export-panel";
import { ProgramImportPanel } from "@/components/program-import-panel";
import { ActiveProgramSetting } from "@/components/active-program-setting";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function SettingsPage() {
  let email = "Local demo";
  if (getSupabasePublicConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? "Authenticated account";
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">Preferences and account</p><h1>Settings</h1></div>
        <Link className="text-link settings-done" href="/">Done</Link>
      </header>
      <section className="settings-list">
        <div><span>Account</span><strong>{email}</strong></div>
        <div><span>Weight unit</span><strong>Pounds</strong></div>
        <div><span>Default increment</span><strong>2.5 lb</strong></div>
        <div><span>Theme</span><strong>System · dark bias</strong></div>
        <ActiveProgramSetting />
      </section>
      <section className="settings-section">
        <p className="eyebrow">Device data</p>
        <p className="muted-copy">Signing out clears the workout cache and pending synchronization queue from this browser. Synced database records remain intact.</p>
        <LogoutButton />
      </section>
      <DataExportPanel />
      <ProgramImportPanel />
    </main>
  );
}
