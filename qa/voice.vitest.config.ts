import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["functions/qa/voice-live.test.ts"],
    environment: "node",
    maxWorkers: 1,
    testTimeout: 110000,
  },
});
