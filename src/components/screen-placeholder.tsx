import Link from "next/link";

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
      <nav className="bottom-nav" aria-label="Primary navigation">
        <Link href="/">Today</Link>
        <Link aria-current={title === "Program" ? "page" : undefined} href="/program">Program</Link>
        <Link aria-current={title === "History" ? "page" : undefined} href="/history">History</Link>
        <Link aria-current={title === "Progress" ? "page" : undefined} href="/progress">Progress</Link>
      </nav>
    </main>
  );
}
