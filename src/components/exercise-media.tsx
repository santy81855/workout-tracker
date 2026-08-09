"use client";

import { useState } from "react";

interface MediaResult { source: string; exerciseName: string; videos: { angle: string; gender: string; url: string; poster: string | null }[] }

export function ExerciseMedia({ exerciseName }: { exerciseName: string }) {
  const [result, setResult] = useState<MediaResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  async function load() {
    setStatus("loading"); setMessage("");
    try {
      const response = await fetch(`/api/musclewiki?name=${encodeURIComponent(exerciseName)}`);
      const data = await response.json() as MediaResult & { error?: string };
      if (!response.ok || data.videos?.length === 0) throw new Error(data.error ?? "No matching video is available.");
      setResult(data); setStatus("idle");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The video could not be loaded."); setStatus("error"); }
  }

  if (!result) return <div className="exercise-media"><button disabled={status === "loading"} onClick={() => void load()} type="button">{status === "loading" ? "Finding video…" : "Show form video"}</button>{status === "error" ? <p role="status">{message}</p> : null}</div>;
  const video = result.videos[0];
  return <div className="exercise-media"><video controls playsInline poster={video.poster ?? undefined} preload="metadata" src={video.url} /><small>{result.exerciseName} · {video.angle} view · Video provided by {result.source}</small></div>;
}
