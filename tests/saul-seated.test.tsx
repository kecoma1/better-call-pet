import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Saul from "../src/components/saul";

function motionPreference(reduced: boolean) {
  const preference = new EventTarget();
  const media = Object.assign(preference, { matches: reduced });
  vi.spyOn(window, "matchMedia").mockReturnValue(media as MediaQueryList);
  return (matches: boolean) => {
    media.matches = matches;
    act(() => media.dispatchEvent(new Event("change")));
  };
}

describe("Saul sitting on the Dots", () => {
  it("plays the silent seated video inline in a loop", () => {
    motionPreference(false);
    render(<Saul state="seated" />);
    const video = screen.getByRole("img", {
      name: "Saul Goodman sitting with your Dots",
    }) as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "/chibi/saul-seated.webm");
    expect(video).toHaveAttribute("poster", "/chibi/saul-seated.png");
    expect(video.autoplay && video.loop && video.muted && video.playsInline).toBe(true);
  });

  it("switches to the still when reduced motion is enabled and resumes when disabled", () => {
    const changePreference = motionPreference(false);
    render(<Saul state="seated" />);
    changePreference(true);
    expect(screen.getByRole("img").tagName).toBe("IMG");
    expect(screen.getByRole("img")).toHaveAttribute("src", "/chibi/saul-seated.png");
    changePreference(false);
    expect(screen.getByRole("img").tagName).toBe("VIDEO");
  });

  it("falls back to animation, then to the still, if media fails", () => {
    motionPreference(false);
    const { rerender } = render(<Saul state="seated" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/chibi/saul-seated.webp");
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute("src", "/chibi/saul-seated.png");
    rerender(<Saul state="thinking" />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/chibi/saul-thinking.webp");
  });
});
