import { NextRequest, NextResponse } from "next/server";

const baseUrl = "https://api.musclewiki.com";
const mediaPathPattern = /^\/stream\/(?:videos|images)\/[A-Za-z0-9_?=&%./-]+$/;

interface MuscleWikiVideo { url?: string | null; angle: string; gender: string; og_image?: string | null }
interface MuscleWikiExercise { id: number; name: string; steps?: string[]; videos?: MuscleWikiVideo[] }

function localMediaUrl(source: string | null | undefined) {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.origin !== baseUrl || !mediaPathPattern.test(`${url.pathname}${url.search}`)) return null;
    return `/api/musclewiki?media=${encodeURIComponent(`${url.pathname}${url.search}`)}`;
  } catch { return null; }
}

async function streamMedia(request: NextRequest, path: string, key: string) {
  if (!mediaPathPattern.test(path)) return NextResponse.json({ error: "Invalid media path." }, { status: 400 });
  const headers = new Headers({ "X-API-Key": key });
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  const response = await fetch(`${baseUrl}${path}`, { headers, cache: "no-store" });
  const outgoing = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) {
    const value = response.headers.get(name); if (value) outgoing.set(name, value);
  }
  return new NextResponse(response.body, { status: response.status, headers: outgoing });
}

export async function GET(request: NextRequest) {
  const key = process.env.MUSCLEWIKI_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Exercise videos are not configured yet." }, { status: 503 });
  const media = request.nextUrl.searchParams.get("media");
  if (media) return streamMedia(request, media, key);

  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name || name.length < 2 || name.length > 120) return NextResponse.json({ error: "A valid exercise name is required." }, { status: 400 });
  const response = await fetch(`${baseUrl}/search?q=${encodeURIComponent(name)}&limit=5`, { headers: { "X-API-Key": key }, next: { revalidate: 86400 } });
  if (!response.ok) {
    const error = response.status === 401 || response.status === 403
      ? "MuscleWiki rejected the API key or subscription level. Check the key and direct API access in your MuscleWiki dashboard."
      : response.status === 404 ? "No matching form video was found." : "MuscleWiki is unavailable right now.";
    return NextResponse.json({ error }, { status: response.status === 404 ? 404 : 502 });
  }
  const payload = await response.json() as { results?: MuscleWikiExercise[] } | MuscleWikiExercise[];
  const results = Array.isArray(payload) ? payload : (payload.results ?? []);
  const normalized = name.toLocaleLowerCase();
  const exercise = results.find((item) => item.name.toLocaleLowerCase() === normalized) ?? results[0];
  if (!exercise) return NextResponse.json({ error: "No matching form video was found." }, { status: 404 });
  return NextResponse.json({
    source: "MuscleWiki", exerciseName: exercise.name,
    videos: (exercise.videos ?? []).map((video) => ({ angle: video.angle, gender: video.gender, url: localMediaUrl(video.url), poster: localMediaUrl(video.og_image) })).filter((video) => video.url),
  });
}
