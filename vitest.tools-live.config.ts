import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["functions/qa/tools-live.test.ts"],
    environment: "node",
    restoreMocks: true,
    fileParallelism: false,
  },
});
