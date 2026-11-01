import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.{ts,tsx}", "functions/tests/**/*.test.ts"],
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    restoreMocks: true,
  },
});
