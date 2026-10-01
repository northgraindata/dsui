/**
 * Host resources, declared so the overview page keeps itself current.
 *
 * Each reading is its own resource with its own interval, so a panel refreshes
 * on the cadence that suits it rather than on whatever the slowest sibling
 * dictates. The host owns the polling; nothing here schedules a timer.
 */
import { defineResource, poll, z } from "@northgraindata/dsui-plugin-sdk";
import type { CpuSample, DiskSample, MemorySample } from "../context.js";
import { sampleCpu, sampleDisk, sampleMemory } from "../context.js";

export type { CpuSample, DiskSample, MemorySample };

/**
 * Load average and core count.
 *
 * Fast and cheap, so it polls more often than disk, whose `statfs` calls touch
 * the filesystem.
 */
export const hostCpu = defineResource({
  id: "host-cpu",
  query: () => sampleCpu(),
  refresh: poll("2s"),
});

/** Total, used, and free memory. */
export const hostMemory = defineResource({
  id: "host-memory",
  query: () => sampleMemory(),
  refresh: poll("2s"),
});

/**
 * Free space on the paths the plugin was configured with.
 *
 * Takes input because the set of paths is configuration, not a constant: a
 * deployment may care about `/data` only.
 */
export const hostDisk = defineResource({
  id: "host-disk",
  input: z.object({
    paths: z
      .array(z.object({ path: z.string().min(1), mount: z.string().min(1) }))
      .min(1),
  }),
  query: async ({ paths }) => {
    const samples = await Promise.all(
      paths.map(async ({ path, mount }) => ({
        mount,
        sample: await sampleDisk(path, mount),
      })),
    );
    return samples.flatMap(({ sample }): DiskSample[] =>
      sample ? [sample] : [],
    );
  },
  refresh: poll("10s"),
});
