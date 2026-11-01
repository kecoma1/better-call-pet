import { useState, useSyncExternalStore } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(onChange: () => void) {
  const preference = window.matchMedia(motionQuery);
  preference.addEventListener("change", onChange);
  return () => preference.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia(motionQuery).matches;

export default function Saul({
  state = "idle",
  className = "",
}: {
  state?: "idle" | "smoking" | "thinking" | "approved" | "seated" | "pacing";
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [failedVideo, setFailedVideo] = useState(false);
  const animation = "/chibi/saul-" + state + ".webp";
  const reduce = useSyncExternalStore(
    subscribeToMotion,
    prefersReducedMotion,
    () => true,
  );
  if (state === "seated" && !reduce && !failedVideo) {
    return (
      <video
        className={"saul " + className}
        src="/chibi/saul-seated.webm"
        poster="/chibi/saul-seated.png"
        autoPlay
        loop
        muted
        playsInline
        role="img"
        aria-label="Saul Goodman sitting with your Dots"
        onError={() => setFailedVideo(true)}
        width={416}
        height={554}
      />
    );
  }
  return (
    <img
      className={"saul " + className}
      src={
        failedSource === animation || reduce
          ? "/chibi/saul-" + state + ".png"
          : animation
      }
      onError={() => setFailedSource(animation)}
      alt={
        state === "pacing"
          ? "Saul Goodman walking from left to right"
          : state === "seated"
            ? "Saul Goodman sitting with your Dots"
            : state === "smoking"
              ? "Saul Goodman smoking a cigar"
              : state === "thinking"
                ? "Saul is thinking"
                : "Saul Goodman, your accounting companion"
      }
      width={416}
      height={554}
    />
  );
}
