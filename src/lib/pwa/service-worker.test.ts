import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serviceWorker = readFileSync(new URL("../../../public/sw.js", import.meta.url), "utf8");

describe("service worker cache boundary", () => {
  it("provides a dedicated offline workout shell", () => {
    expect(serviceWorker).toContain('const OFFLINE_WORKOUT_URL = "/offline-workout"');
    expect(serviceWorker).toContain("caches.match(OFFLINE_WORKOUT_URL)");
    expect(serviceWorker).toContain('"/app-icon.svg"');
  });

  it("only runtime-caches static asset destinations", () => {
    expect(serviceWorker).toContain('url.pathname.startsWith("/_next/static/")');
    expect(serviceWorker).toContain('["style", "script", "font", "image"]');
    expect(serviceWorker).not.toContain("/rest/v1");
    expect(serviceWorker).not.toContain("/auth/v1");
  });

  it("supports explicit updates and private-cache clearing", () => {
    expect(serviceWorker).toContain("SKIP_WAITING");
    expect(serviceWorker).toContain("CLEAR_PRIVATE_CACHES");
  });
});
