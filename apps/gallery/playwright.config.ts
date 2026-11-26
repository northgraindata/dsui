import { defineConfig, devices } from "@playwright/test";

const PORT = 5180;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Visual baselines depend on the rendering platform, so they are generated
  // per machine instead of committed. See agents/commands.md.
  snapshotDir: process.env.DSUI_SNAPSHOT_DIR ?? "./.snapshots",
  snapshotPathTemplate: "{snapshotDir}/{arg}{ext}",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: `http://127.0.0.1:${PORT}`,
    contextOptions: { reducedMotion: "reduce" },
  },
  webServer: {
    command: `bunx vite build --logLevel warn && bunx vite preview --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
