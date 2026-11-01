export type VoiceLevels = readonly [number, number, number, number, number];
export const SILENT_LEVELS: VoiceLevels = [0, 0, 0, 0, 0];
export type CallAudioLevels = {microphone: VoiceLevels; assistant: VoiceLevels};
export const SILENT_CALL_LEVELS: CallAudioLevels = {microphone: SILENT_LEVELS, assistant: SILENT_LEVELS};

// Read three frequency bands; mirror them around bass for the five-bar emblem.
export function frequencyLevels(data: Uint8Array, sampleRate: number, fftSize: number): VoiceLevels {
  const ranges = [[80, 300], [300, 2000], [2000, 8000]];
  const values = ranges.map(([low, high]) => {
    let sum = 0; let count = 0; let peak = 0;
    for (let i = Math.ceil(low * fftSize / sampleRate); i < Math.min(data.length, high * fftSize / sampleRate); i++) {
      sum += data[i] ** 2; count++; peak = Math.max(peak, data[i]);
    }
    const rms = count ? Math.sqrt(sum / count) : 0;
    return Math.max(0, Math.min(1, (0.65 * peak + 0.35 * rms - 25) / 180));
  });
  return [values[2], values[1], values[0], values[1], values[2]];
}

function smoothLevels(current: readonly number[], previous: VoiceLevels): VoiceLevels {
  return current.map((value, i) => {
    const smooth = previous[i] + (value - previous[i]) * (value > previous[i] ? 0.45 : 0.25);
    return smooth < 0.015 ? 0 : smooth;
  }) as unknown as VoiceLevels;
}

export function observeCallAudio(onLevels: (levels: CallAudioLevels) => void) {
  let context: AudioContext | undefined;
  let frame = 0; let stopped = false; let muted = false; let previous = SILENT_CALL_LEVELS;
  let last = 0;
  const sources: {source: MediaStreamAudioSourceNode; analyser: AnalyserNode; data: Uint8Array<ArrayBuffer>; mic: boolean}[] = [];
  const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const tick = (time: number) => {
    if (stopped) return;
    if (time - last >= 50) {
      last = time;
      const microphone = [...SILENT_LEVELS];
      const assistant = [...SILENT_LEVELS];
      if (!motion?.matches) for (const item of sources) {
        if (item.mic && muted) continue;
        item.analyser.getByteFrequencyData(item.data);
        const target = item.mic ? microphone : assistant;
        frequencyLevels(item.data, context!.sampleRate, item.analyser.fftSize).forEach((value, i) => {target[i] = Math.max(target[i], value);});
      }
      previous = motion?.matches ? SILENT_CALL_LEVELS : {
        microphone: muted ? SILENT_LEVELS : smoothLevels(microphone, previous.microphone),
        assistant: smoothLevels(assistant, previous.assistant),
      };
      onLevels(previous);
    }
    frame = requestAnimationFrame(tick);
  };
  return {
    add(stream: MediaStream, mic: boolean) {
      if (stopped || !window.AudioContext || sources.some((item) => item.source.mediaStream === stream)) return;
      try {
        context ??= new AudioContext();
        void context.resume().catch(() => undefined);
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser); // No destination connection: never play back the microphone.
        sources.push({source, analyser, data: new Uint8Array(analyser.frequencyBinCount), mic});
        if (!frame) frame = requestAnimationFrame(tick);
      } catch { /* Visualisation is optional; audio calls still work. */ }
    },
    mute(value: boolean) {
      muted = value;
      if (muted && !stopped) {
        previous = {...previous, microphone: SILENT_LEVELS};
        onLevels(previous);
      }
    },
    stop() {
      if (stopped) return;
      stopped = true; cancelAnimationFrame(frame);
      sources.forEach(({source, analyser}) => {source.disconnect(); analyser.disconnect();});
      if (context) void context.close().catch(() => undefined);
      onLevels(SILENT_CALL_LEVELS);
    },
  };
}
