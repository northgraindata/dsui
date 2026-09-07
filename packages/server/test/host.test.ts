import { describe, expect, it } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const hostEntry = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "adapter-host.ts",
);
const bundle = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "mini-adapter.mjs",
);

async function hostCall(
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const child = Bun.spawn(
    [process.execPath, hostEntry, "adapter-host", "--bundle", bundle],
    {
      stdin: new Blob([
        `${JSON.stringify({ jsonrpc: "2.0", id: "t1", method, params })}\n`,
      ]).stream(),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`host exited ${code}: ${stderr}`);
  const response = JSON.parse(stdout.trim()) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (response.error) throw new Error(response.error.message);
  return response.result;
}

describe("adapter-host subprocess", () => {
  it("describes the bundle catalog", async () => {
    const described = (await hostCall("describe")) as {
      metadata: { id: string };
      resources: Array<{ id: string }>;
      actions: Array<{ id: string }>;
      pages: Array<{ path: string }>;
    };
    expect(described.metadata.id).toBe("fixture");
    expect(described.resources.map((resource) => resource.id)).toEqual([
      "things",
    ]);
    expect(described.actions.map((action) => action.id)).toEqual(["refresh"]);
    expect(described.pages).toEqual([{ path: "/things" }]);
  });

  it("probes health and executes resources and actions", async () => {
    const health = (await hostCall("health", {
      connection: {},
    })) as { status: string };
    expect(health.status).toBe("healthy");
    const resource = (await hostCall("resource", {
      connection: {},
      target: "things",
      input: {},
    })) as { data: unknown };
    expect(resource).toEqual({ data: [{ name: "alpha" }, { name: "beta" }] });
    const action = (await hostCall("action", {
      connection: {},
      target: "refresh",
      input: {},
    })) as { status: string; data: unknown };
    expect(action).toEqual({ status: "success", data: "refreshed" });
  });

  it("reports unknown targets as JSON-RPC errors", async () => {
    await expect(
      hostCall("resource", { connection: {}, target: "missing" }),
    ).rejects.toThrow("Unknown resource");
    await expect(hostCall("bogus", {})).rejects.toThrow("Unknown method");
  });
});
