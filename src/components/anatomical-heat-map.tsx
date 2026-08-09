"use client";

import type { BodyChart as BodyChartType, BodyState } from "body-muscles";
import { useEffect, useRef } from "react";

const groups: Record<string, string[]> = {
  chest: ["chest-upper-left", "chest-lower-left", "chest-upper-right", "chest-lower-right"],
  back: ["traps-upper-left", "traps-mid-left", "traps-lower-left", "traps-upper-right", "traps-mid-right", "traps-lower-right", "lats-upper-left", "lats-mid-left", "lats-lower-left", "lats-upper-right", "lats-mid-right", "lats-lower-right"],
  shoulders: ["shoulder-front-left", "shoulder-side-left", "shoulder-front-right", "shoulder-side-right", "deltoid-rear-left", "deltoid-rear-right"],
  biceps: ["biceps-left", "biceps-right"],
  triceps: ["triceps-long-left", "triceps-lateral-left", "triceps-long-right", "triceps-lateral-right"],
  abs: ["abs-upper-left", "abs-upper-right", "abs-lower-left", "abs-lower-right", "obliques-left", "obliques-right"],
  quads: ["quads-left", "quads-right"],
  hamstrings: ["hamstrings-medial-left", "hamstrings-lateral-left", "hamstrings-medial-right", "hamstrings-lateral-right"],
  glutes: ["gluteus-medius-left", "gluteus-maximus-left", "gluteus-medius-right", "gluteus-maximus-right"],
  calves: ["calves-gastroc-medial-left", "calves-gastroc-lateral-left", "calves-soleus-left", "calves-gastroc-medial-right", "calves-gastroc-lateral-right", "calves-soleus-right"],
};

export function AnatomicalHeatMap({ values }: { values: Record<string, number> }) {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let front: BodyChartType | undefined;
    let back: BodyChartType | undefined;
    let cancelled = false;
    void import("body-muscles").then(({ BodyChart, ViewSide }) => {
      if (cancelled || !frontRef.current || !backRef.current) return;
      const bodyState: BodyState = {};
      for (const [group, ids] of Object.entries(groups)) {
        const intensity = Math.max(0, Math.min(10, Math.round(((values[group] ?? 0) / 15) * 10)));
        for (const id of ids) bodyState[id] = { intensity, selected: intensity > 0 };
      }
      front = new BodyChart(frontRef.current, { view: ViewSide.FRONT, bodyState, ariaLabel: "Front muscle exposure", showViewLabel: false });
      back = new BodyChart(backRef.current, { view: ViewSide.BACK, bodyState, ariaLabel: "Back muscle exposure", showViewLabel: false });
    });
    return () => { cancelled = true; front?.destroy(); back?.destroy(); };
  }, [values]);
  return <div className="anatomical-heat-map"><div><span>Front</span><div ref={frontRef} /></div><div><span>Back</span><div ref={backRef} /></div></div>;
}
