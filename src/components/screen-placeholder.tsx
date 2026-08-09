import { BottomNavigation } from "@/components/bottom-navigation";

interface ScreenPlaceholderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function ScreenPlaceholder({ eyebrow, title, description }: ScreenPlaceholderProps) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </header>
      <section className="section-block">
        <h2>Foundation ready</h2>
        <p className="muted-copy placeholder-copy">{description}</p>
      </section>
      <BottomNavigation />
    </main>
  );
}
