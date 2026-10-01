import { statfs } from "node:fs/promises";
import {
  availableParallelism,
  freemem,
  loadavg,
  totalmem,
  uptime,
} from "node:os";

/**
 * Host resource sampling.
 *
 * These are the resources of the machine running DSUI, not of the services it
 * connects to. A remote PostgreSQL or Airflow deployment reports nothing about
 * this host, which is why a signal here only applies to services whose data
 * lives on this filesystem — a local DuckDB file, for example. Deciding which
 * services those are belongs to the health plugin, which knows adapter
 * semantics; this plugin only reports what the host can observe.
 */

export type CpuSample = {
  /** One-, five- and fifteen-minute load averages. */
  readonly loadAverage: readonly [number, number, number];
  /** Number of logical cores, used to interpret load average. */
  readonly cores: number;
};

export type MemorySample = {
  readonly totalBytes: number;
  readonly usedBytes: number;
  /** 0-100. */
  readonly usedPercent: number;
};

export type DiskSample = {
  readonly mount: string;
  readonly totalBytes: number;
  readonly freeBytes: number;
  /** 0-100. */
  readonly usedPercent: number;
};

export type HostSample = {
  readonly cpu: CpuSample;
  readonly memory: MemorySample;
  readonly disk: readonly DiskSample[];
  /** Process uptime in seconds. */
  readonly uptimeSeconds: number;
  readonly processMemoryBytes: number;
};

export function sampleCpu(): CpuSample {
  const [one, five, fifteen] = loadavg();
  return {
    loadAverage: [one, five, fifteen],
    // `availableParallelism` reflects cgroup limits a container imposes, so a
    // load average inside a constrained container is not compared against the
    // bare host's core count.
    cores: availableParallelism(),
  };
}

export function sampleMemory(): MemorySample {
  const totalBytes = totalmem();
  const freeBytes = freemem();
  const usedBytes = totalBytes - freeBytes;
  return {
    totalBytes,
    usedBytes,
    usedPercent: totalBytes === 0 ? 0 : round((usedBytes / totalBytes) * 100),
  };
}

/**
 * Samples a mounted filesystem.
 *
 * `statfs` takes the path rather than the mount point, so callers pass a path
 * that lives on the volume they care about. A path that cannot be read is
 * skipped rather than failing the whole sample.
 */
export async function sampleDisk(
  path: string,
  mount: string,
): Promise<DiskSample | null> {
  try {
    const info = await statfs(path);
    if (info.blocks === 0) return null;
    const blockSize = info.bsize;
    const totalBytes = info.blocks * blockSize;
    const freeBytes = info.bavail * blockSize;
    return {
      mount,
      totalBytes,
      freeBytes,
      usedPercent: round((1 - info.bavail / info.blocks) * 100),
    };
  } catch {
    return null;
  }
}

export function sampleProcessMemory(): number {
  return process.memoryUsage().rss;
}

/** Process uptime in seconds. */
export function sampleUptime(): number {
  return uptime();
}

/**
 * Samples every volume in one pass.
 *
 * Volumes that cannot be read are dropped rather than failing the sample, so
 * one unmounted path does not hide the state of the rest.
 */
export async function sampleVolumes(
  entries: readonly { path: string; mount: string }[],
): Promise<DiskSample[]> {
  const samples = await Promise.all(
    entries.map((entry) => sampleDisk(entry.path, entry.mount)),
  );
  return samples.flatMap((sample) => (sample ? [sample] : []));
}

/** Formats bytes for display without pulling in a formatting dependency. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
