import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import app from "./app.js";
export const api = onRequest(
  {
    region: "europe-west2",
    secrets: [defineSecret("OPENAI_API_KEY")],
    timeoutSeconds: 120,
    memory: "512MiB",
    maxInstances: 5,
  },
  app,
);
