import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DemoVideoButton from "../src/components/demo-video-button";
import { DEMO_VIDEO_SRC } from "../src/lib/demo-video";
import { checkDemoVideoAvailable, resetDemoVideoCheck } from "../src/services/demo-video";

function mockHead(status: number, contentType: string) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status, headers: { "content-type": contentType } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  resetDemoVideoCheck();
  vi.unstubAllGlobals();
});

describe("demo video availability", () => {
  it("checks once with HEAD and accepts only video content types", async () => {
    const fetchMock = mockHead(200, "video/mp4");
    expect(await checkDemoVideoAvailable()).toBe(true);
    expect(await checkDemoVideoAvailable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(DEMO_VIDEO_SRC, { method: "HEAD" });
  });

  it("rejects the SPA fallback html, 404s and network errors", async () => {
    mockHead(200, "text/html");
    expect(await checkDemoVideoAvailable()).toBe(false);
    resetDemoVideoCheck();
    mockHead(404, "video/mp4");
    expect(await checkDemoVideoAvailable()).toBe(false);
    resetDemoVideoCheck();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await checkDemoVideoAvailable()).toBe(false);
  });
});

describe("DemoVideoButton", () => {
  it("renders nothing when the video is unavailable", async () => {
    const fetchMock = mockHead(200, "text/html");
    const { container } = render(<DemoVideoButton />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the button when available and opens the video dialog", async () => {
    mockHead(200, "video/mp4");
    render(<DemoVideoButton />);
    fireEvent.click(await screen.findByRole("button", { name: "Watch the demo" }));
    expect(await screen.findByText("Better Call Pet · demo")).toBeInTheDocument();
    const video = document.querySelector("video")!;
    expect(video).toHaveAttribute("src", DEMO_VIDEO_SRC);
    expect(video).toHaveAttribute("controls");
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("video")).toBeNull());
  });
});
