import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";

const bootId = randomUUID();

function swapUsedBytes(): number | null {
  try {
    const text = readFileSync("/proc/meminfo", "utf8");
    const total = /^SwapTotal:\s+(\d+)\s+kB/m.exec(text);
    const free = /^SwapFree:\s+(\d+)\s+kB/m.exec(text);
    return total && free ? (Number(total[1]) - Number(free[1])) * 1024 : null;
  } catch {
    return null;
  }
}

function hostTimes() {
  let idle = 0;
  let total = 0;
  for (const { times } of cpus()) {
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

/** Lazy lifecycle: importing a plugin must not start a background timer. */
let previous:
  | { wall: number; cpu: NodeJS.CpuUsage; host: ReturnType<typeof hostTimes> }
  | undefined;
let delay: ReturnType<typeof monitorEventLoopDelay> | undefined;
export function stopRuntimeMetrics() {
  delay?.disable();
  delay = undefined;
  previous = undefined;
}

export function runtimeMetrics() {
  if (!delay) {
    delay = monitorEventLoopDelay({ resolution: 100 });
    delay.enable();
  }
  const current = {
    wall: performance.now(),
    cpu: process.cpuUsage(),
    host: hostTimes(),
  };
  const elapsed = previous ? current.wall - previous.wall : 0;
  const hostTotal = previous ? current.host.total - previous.host.total : 0;
  const processCpuPercent =
    previous && elapsed > 0
      ? ((current.cpu.user -
          previous.cpu.user +
          current.cpu.system -
          previous.cpu.system) /
          (elapsed * 1000)) *
        100
      : null;
  const hostCpuPercent =
    previous && hostTotal > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (1 - (current.host.idle - previous.host.idle) / hostTotal) * 100,
          ),
        )
      : null;
  const result = {
    bootId,
    swapUsedBytes: swapUsedBytes(),
    processCpuPercent,
    hostCpuPercent,
    processRssBytes: process.memoryUsage().rss,
    processHeapUsedBytes: process.memoryUsage().heapUsed,
    eventLoopMaxMs: delay.count > 0 ? delay.max / 1000000 : null,
    processUptimeSeconds: process.uptime(),
  };
  delay.reset();
  previous = current;
  return result;
}
