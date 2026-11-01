import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/firestore-rules.integration.ts"],
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
