import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "functions/tests/tools.test.ts",
      "functions/tests/chat-tools.test.ts",
      "functions/tests/chat.test.ts",
      "functions/tests/security.test.ts",
      "functions/tests/voice-agent.test.ts",
      "functions/tests/voice-transport.test.ts",
    ],
    environment: "node",
    restoreMocks: true,
    unstubEnvs: true,
  },
});
