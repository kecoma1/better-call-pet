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
const label = "Saul Goodman writing and reading case files at his desk";
describe("Saul’s comic desk loading loop", () => {
  it("plays the desk video inline, muted and in an automatic loop", () => {
    motionPreference(false);
    render(<Saul state="desk" />);
    const video = screen.getByRole("img", { name: label }) as HTMLVideoElement;
    expect(video.tagName).toBe("VIDEO");
    expect(video).toHaveAttribute("src", "/chibi/saul-desk.webm");
    expect(video).toHaveAttribute("poster", "/chibi/saul-desk.png");
    expect(
      video.autoplay && video.loop && video.muted && video.playsInline,
    ).toBe(true);
  });
  it("uses a matching still for reduced motion and resumes the loop when enabled", () => {
    const changePreference = motionPreference(true);
    render(<Saul state="desk" />);
    expect(screen.getByRole("img", { name: label })).toHaveAttribute(
      "src",
      "/chibi/saul-desk.png",
    );
    changePreference(false);
    expect(screen.getByRole("img", { name: label }).tagName).toBe("VIDEO");
  });
  it("falls back from WebM to the animated WebP and then to a matching still", () => {
    motionPreference(false);
    render(<Saul state="desk" />);
    fireEvent.error(screen.getByRole("img", { name: label }));
    expect(screen.getByRole("img", { name: label })).toHaveAttribute(
      "src",
      "/chibi/saul-desk.webp",
    );
    fireEvent.error(screen.getByRole("img", { name: label }));
    expect(screen.getByRole("img", { name: label })).toHaveAttribute(
      "src",
      "/chibi/saul-desk.png",
    );
  });
  it("keeps a failed seated video from disabling the separate desk loop", () => {
    motionPreference(false);
    const { rerender } = render(<Saul state="seated" />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/chibi/saul-seated.webp",
    );
    rerender(<Saul state="desk" />);
    expect(screen.getByRole("img", { name: label }).tagName).toBe("VIDEO");
  });
});
