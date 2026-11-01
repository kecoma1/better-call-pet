import { useState } from "react";
export default function Saul({
  state = "idle",
  className = "",
}: {
  state?: "idle" | "thinking" | "approved" | "seated";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <img
      className={"saul " + className}
      src={
        failed || reduce || state === "seated"
          ? "/chibi/saul-" + state + ".png"
          : "/chibi/saul-" + state + ".webp"
      }
      onError={() => setFailed(true)}
      alt={
        state === "seated"
          ? "Saul Goodman sitting with your Dots"
          : state === "thinking"
            ? "Saul is thinking"
            : "Saul Goodman, your accounting companion"
      }
      width={416}
      height={554}
    />
  );
}
