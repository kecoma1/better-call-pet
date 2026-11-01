import { useState } from "react";
export default function Saul({
  state = "idle",
  className = "",
}: {
  state?: "idle" | "smoking" | "thinking" | "approved" | "seated";
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const animation = "/chibi/saul-" + state + ".webp";
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <img
      className={"saul " + className}
      src={
        failedSource === animation || reduce || state === "seated"
          ? "/chibi/saul-" + state + ".png"
          : animation
      }
      onError={() => setFailedSource(animation)}
      alt={
        state === "seated"
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
