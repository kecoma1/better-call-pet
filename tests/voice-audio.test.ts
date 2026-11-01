import {afterEach, expect, it, vi} from "vitest";
import {frequencyLevels, observeCallAudio, SILENT_CALL_LEVELS, SILENT_LEVELS} from "../src/services/voice-audio";
afterEach(() => vi.unstubAllGlobals());
it("separates real bass, mid and treble bins with a silent noise floor", () => {
  const data = new Uint8Array(1024);
  expect(frequencyLevels(data, 48000, 2048)).toEqual([0, 0, 0, 0, 0]);
  for (let i = 4; i < 13; i++) data[i] = 200;
  const levels = frequencyLevels(data, 48000, 2048);
  expect(levels[2]).toBeGreaterThan(0.8); expect(levels[0]).toBe(0); expect(levels[1]).toBe(0);
  data.fill(0); data[256] = 220;
  expect(frequencyLevels(data, 48000, 2048)[0]).toBeGreaterThan(0.6);
});
it("keeps mic and assistant levels separate, silences only the muted mic and cleans all nodes", () => {
  let tick!: FrameRequestCallback;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => {tick = callback; return 1;}));
  const cancel = vi.fn(); vi.stubGlobal("cancelAnimationFrame", cancel);
  const analysers: {energy: number; disconnect: ReturnType<typeof vi.fn>}[] = [];
  const nodes: {disconnect: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn>}[] = [];
  const close = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("AudioContext", class {
    sampleRate = 48000; resume = async () => undefined; close = close;
    createMediaStreamSource(mediaStream: MediaStream) {const node = {mediaStream, connect: vi.fn(), disconnect: vi.fn()}; nodes.push(node); return node;}
    createAnalyser() {const node = {energy: 0, fftSize: 2048, frequencyBinCount: 1024, disconnect: vi.fn(), getByteFrequencyData(data: Uint8Array) {data.fill(this.energy);}}; analysers.push(node); return node;}
  });
  let reduce = false; vi.stubGlobal("matchMedia", () => ({get matches() {return reduce;}}));
  const update = vi.fn(); const observer = observeCallAudio(update);
  observer.add({} as MediaStream, true); observer.add({} as MediaStream, false);
  analysers[0].energy = 200; tick(100);
  expect(update.mock.lastCall?.[0].microphone[2]).toBeGreaterThan(0);
  expect(update.mock.lastCall?.[0].assistant).toEqual(SILENT_LEVELS);
  analysers[1].energy = 100; tick(150);
  expect(update.mock.lastCall?.[0].assistant[2]).toBeGreaterThan(0);
  expect(update.mock.lastCall?.[0].assistant[2]).toBeLessThan(update.mock.lastCall?.[0].microphone[2]);
  const assistantBeforeMute = update.mock.lastCall?.[0].assistant;
  observer.mute(true); analysers[0].energy = 255;
  expect(update.mock.lastCall?.[0]).toEqual({microphone: SILENT_LEVELS, assistant: assistantBeforeMute});
  analysers[1].energy = 0;
  for (let i = 2; i < 30; i++) tick(i * 100);
  expect(update.mock.lastCall?.[0]).toEqual(SILENT_CALL_LEVELS);
  analysers[1].energy = 180; tick(3100);
  expect(update.mock.lastCall?.[0].assistant[2]).toBeGreaterThan(0);
  expect(update.mock.lastCall?.[0].microphone).toEqual(SILENT_LEVELS);
  observer.mute(false); tick(3150);
  expect(update.mock.lastCall?.[0].microphone[2]).toBeGreaterThan(0);
  reduce = true; tick(3200);
  expect(update.mock.lastCall?.[0]).toEqual(SILENT_CALL_LEVELS);
  nodes.forEach((node) => expect(node.connect).toHaveBeenCalledTimes(1));
  observer.stop(); observer.stop();
  expect(cancel).toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce();
  nodes.forEach((node) => expect(node.disconnect).toHaveBeenCalledOnce());
  expect(update.mock.lastCall?.[0]).toEqual(SILENT_CALL_LEVELS);
});
