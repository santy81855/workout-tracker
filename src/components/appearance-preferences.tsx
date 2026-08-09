"use client";

import { useEffect, useState } from "react";

const accents = [
  { id: "blue", label: "Blue" },
  { id: "green", label: "Green" },
  { id: "purple", label: "Purple" },
  { id: "orange", label: "Orange" },
  { id: "rose", label: "Rose" },
  { id: "cyan", label: "Cyan" },
  { id: "teal", label: "Teal" },
  { id: "lime", label: "Lime" },
  { id: "amber", label: "Amber" },
  { id: "red", label: "Red" },
  { id: "indigo", label: "Indigo" },
  { id: "pink", label: "Pink" },
] as const;

type Accent = (typeof accents)[number]["id"];
const storageKey = "workout-accent";

function applyAccent(accent: Accent) {
  document.documentElement.dataset.accent = accent;
}

export function AppearanceHydration() {
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (accents.some((accent) => accent.id === stored)) applyAccent(stored as Accent);
  }, []);
  return null;
}

export function AppearancePreferences() {
  const [selected, setSelected] = useState<Accent>("blue");

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!accents.some((accent) => accent.id === stored)) return;
    const frame = window.requestAnimationFrame(() => setSelected(stored as Accent));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function choose(accent: Accent) {
    setSelected(accent);
    localStorage.setItem(storageKey, accent);
    applyAccent(accent);
  }

  return (
    <section className="settings-section appearance-settings">
      <p className="eyebrow">Styles</p><h2>Accent color</h2>
      <p className="muted-copy">Choose the color used for active controls and progress. Swipe sideways for more options. Saved on this device.</p>
      <div className="accent-options" role="group" aria-label="Accent color">
        {accents.map((accent) => (
          <button aria-pressed={selected === accent.id} className={`accent-option accent-${accent.id}`} key={accent.id} onClick={() => choose(accent.id)} type="button">
            <span aria-hidden="true" />{accent.label}
          </button>
        ))}
      </div>
    </section>
  );
}
