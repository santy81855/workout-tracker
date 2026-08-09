import { LogoutButton } from "@/components/logout-button";
import { DataExportPanel } from "@/components/data-export-panel";
import { ProgramImportPanel } from "@/components/program-import-panel";
import { ActiveProgramSetting } from "@/components/active-program-setting";
import { AppearancePreferences } from "@/components/appearance-preferences";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { BottomNavigation } from "@/components/bottom-navigation";

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
      <AppearancePreferences />
      <DataExportPanel />
      <ProgramImportPanel />
      <section className="settings-section signout-section">
        <p className="eyebrow">Account</p><h2>Sign out of this device</h2>
        <p className="muted-copy">This removes your login and offline workout copies from this phone or computer. Workouts already synced to your account remain safe and return after you sign in again.</p>
        <LogoutButton />
      </section>
      <BottomNavigation />
    </main>
  );
}
