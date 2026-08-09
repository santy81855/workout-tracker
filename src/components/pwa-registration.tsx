"use client";

import { useEffect, useState } from "react";

export function PwaRegistration() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let refreshing = false;

    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        if (registration.waiting) setWaitingWorker(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) setWaitingWorker(worker);
          });
        });
      })
      .catch(() => {
        // PWA installation remains optional; the online app continues to work.
      });

    function handleControllerChange() {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
  }, []);

  if (!waitingWorker) return null;

  return (
    <aside className="update-toast" role="status">
      <div><strong>Update ready</strong><span>Your saved workout will remain on this device.</span></div>
      <button onClick={() => waitingWorker.postMessage({ type: "SKIP_WAITING" })} type="button">Update</button>
    </aside>
  );
}
