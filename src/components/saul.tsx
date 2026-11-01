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
  state?:
    | "idle"
    | "smoking"
    | "thinking"
    | "approved"
    | "seated"
    | "pacing"
    | "phone"
    | "desk";
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [failedVideoSource, setFailedVideoSource] = useState<string | null>(
    null,
  );
  const video =
    state === "seated" || state === "desk"
      ? "/chibi/saul-" + state + ".webm"
      : null;
  const videoLabel =
    state === "desk"
      ? "Saul Goodman writing and reading case files at his desk"
      : "Saul Goodman sitting with your Dots";
  const animation = "/chibi/saul-" + state + ".webp";
  const reduce = useSyncExternalStore(
    subscribeToMotion,
    prefersReducedMotion,
    () => true,
  );
  if (video && !reduce && failedVideoSource !== video) {
    return (
      <video
        className={"saul " + className}
        src={video}
        poster={"/chibi/saul-" + state + ".png"}
        autoPlay
        loop
        muted
        playsInline
        role="img"
        aria-label={videoLabel}
        onError={() => setFailedVideoSource(video)}
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
        state === "desk"
          ? videoLabel
          : state === "phone"
            ? "Saul Goodman talking on the phone"
            : state === "pacing"
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
