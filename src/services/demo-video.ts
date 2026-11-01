import { DEMO_VIDEO_SRC } from "../lib/demo-video";

let availability: Promise<boolean> | undefined;

// The SPA fallback answers missing files with index.html and HTTP 200, so the
// content type must be video/* for the demo to count as present.
async function probe(): Promise<boolean> {
  try {
    const response = await fetch(DEMO_VIDEO_SRC, { method: "HEAD" });
    return response.ok && (response.headers.get("content-type") ?? "").toLowerCase().startsWith("video/");
  } catch {
    return false;
  }
}

/** Checked once per page load; every caller shares the same answer. */
export function checkDemoVideoAvailable(): Promise<boolean> {
  availability ??= probe();
  return availability;
}

export function resetDemoVideoCheck() {
  availability = undefined;
}
