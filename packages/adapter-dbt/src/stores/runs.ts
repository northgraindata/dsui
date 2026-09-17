import { defineStore } from "@northgraindata/dsui-adapter-sdk";
import type { ArtifactName } from "../artifacts.js";

export type ArchivedArtifact = {
  name: ArtifactName;
  contentType: "application/json";
  size: number;
  content: string;
};

export type ArchivedRun = {
  id: string;
  job: string;
  jobId: string;
  status: "success" | "error";
  cause: string;
  startedAt: string;
  durationMs: number;
  exitCode: number;
  stdout: string;
  stderr: string;
  artifacts: ArchivedArtifact[];
};

export type DbtRunState = {
  runs: ArchivedRun[];
};

export const dbtRunStore = defineStore({
  id: "dbt-runs",
  scope: "adapter",
  persistence: {
    type: "persistent",
    key: "dbt-runs",
    version: 1,
  },
  state: {
    runs: [] as ArchivedRun[],
  } satisfies DbtRunState,
  actions: ({ get, set }) => ({
    addRun: (run: ArchivedRun) =>
      set({ runs: [run, ...get().runs].slice(0, 50) }),
  }),
});
