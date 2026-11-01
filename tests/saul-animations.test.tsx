import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import NotificationsBanner from "../src/components/notifications-banner";
import Saul from "../src/components/saul";
import { demoReceipts } from "../src/domain";

function motionPreference(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

describe("distinct Saul animations by placement", () => {
  it.each([false, true])(
    "updates notification artwork with its review state (reduced motion: %s)",
    (reduced) => {
      motionPreference(reduced);
      const props = { onSelect: vi.fn(), onAdd: vi.fn(), onNavigate: vi.fn() };
      const { rerender } = render(
        <NotificationsBanner {...props} items={demoReceipts} />,
      );
      const suffix = reduced ? ".png" : ".webp";
      const banner = screen.getByRole("region", { name: "Notifications" });
      expect(within(banner).getByRole("img")).toHaveAttribute(
        "src",
        "/chibi/saul-thinking" + suffix,
      );
      rerender(
        <NotificationsBanner {...props} items={[]} />,
      );
      expect(within(banner).getByRole("img")).toHaveAttribute(
        "src",
        "/chibi/saul-approved" + suffix,
      );
    },
  );

  it("uses the matching still after a failed animation and recovers on a different state", () => {
    motionPreference(false);
    const { rerender } = render(<Saul state="smoking" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/chibi/saul-smoking.png",
    );
    rerender(<Saul state="thinking" />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/chibi/saul-thinking.webp",
    );
  });

  it("ships different animation files rather than aliases of the same video", () => {
    const hashes = ["smoking", "thinking", "approved"].map((state) =>
      createHash("sha256")
        .update(
          readFileSync(
            resolve("public/chibi", `saul-${state}.webp`),
          ),
        )
        .digest("hex"),
    );
    expect(new Set(hashes).size).toBe(3);
  });
});
