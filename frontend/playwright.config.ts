import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  use: {
    baseURL: process.env.LAB_TEST_URL || "http://127.0.0.1:3000",
    channel: process.env.LAB_BROWSER_CHANNEL || undefined,
  },
});
