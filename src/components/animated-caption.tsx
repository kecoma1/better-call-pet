import type { CSSProperties } from "react";

export default function AnimatedCaption({ text }: { text: string }) {
  return <span className="animated-caption">{text.split(/(\s+)/).map((word, index) =>
    <span key={index} style={{ "--reveal-delay": `${Math.min(index * 18, 200)}ms` } as CSSProperties}>{word}</span>,
  )}</span>;
}
