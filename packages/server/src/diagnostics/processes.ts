import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { DiagnosticProcess } from "@northgraindata/dsui-plugin-sdk";

type Identity = Pick<DiagnosticProcess, "pid" | "adapterId" | "serviceId">;
export function createProcessSampler() {
  const previous = new Map<
    number,
    { at: number; ticks: number; start: string }
  >();
  let clock: Promise<number | null> | undefined;
  const tickRate = () =>
    (clock ??= new Promise((resolve) => {
      execFile("getconf", ["CLK_TCK"], { timeout: 1000 }, (error, stdout) => {
        const value = Number(stdout.trim());
        resolve(!error && Number.isFinite(value) && value > 0 ? value : null);
      });
    }));
  return async (
    identities: readonly Identity[],
  ): Promise<DiagnosticProcess[]> => {
    if (process.platform !== "linux")
      return identities.map((identity) => ({
        ...identity,
        rssBytes: null,
        cpuPercent: null,
      }));
    const hz = await tickRate();
    const pids = new Set(identities.map(({ pid }) => pid));
    for (const pid of previous.keys()) if (!pids.has(pid)) previous.delete(pid);
    return Promise.all(
      identities.slice(0, 128).map(async (identity) => {
        try {
          const [stat, status] = await Promise.all([
            readFile(`/proc/${identity.pid}/stat`, "utf8"),
            readFile(`/proc/${identity.pid}/status`, "utf8"),
          ]);
          const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
          const ticks = Number(fields[11]) + Number(fields[12]);
          const start = fields[19];
          const at = performance.now();
          const before = previous.get(identity.pid);
          const cpuPercent =
            hz && before && before.start === start && at > before.at
              ? Math.max(
                  0,
                  ((ticks - before.ticks) / hz / ((at - before.at) / 1000)) *
                    100,
                )
              : null;
          const rss = /^VmRSS:\s+(\d+)\s+kB/m.exec(status);
          previous.set(identity.pid, { at, ticks, start });
          return {
            ...identity,
            rssBytes: rss ? Number(rss[1]) * 1024 : null,
            cpuPercent,
          };
        } catch {
          return { ...identity, rssBytes: null, cpuPercent: null };
        }
      }),
    );
  };
}
