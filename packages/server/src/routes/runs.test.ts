import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type {
  Run,
  RunArtifact,
  RunProtocol,
  StartRunResponse,
} from "../runs/contracts.js";
import { registerRunRoutes } from "./runs.js";

const run: Run = {
  invocationId: "invocation-1",
  request: {
    command: "build",
    project: { path: "/private/workspace/project" },
    environment: { TOKEN: { value: "secret-value" } },
  },
  state: "queued",
  createdAt: "2026-01-01T00:00:00.000Z",
  cancellable: true,
  retryable: false,
};

const artifact: RunArtifact = {
  artifactId: "artifact-1",
  kind: "manifest",
  contentType: "application/json",
  invocationId: run.invocationId,
  location: { kind: "local", ref: "/private/workspace/manifest.json" },
  downloadable: true,
};

function app(
  principal: "viewer" | "operator" = "operator",
  protocol?: Partial<RunProtocol>,
) {
  const application = new Hono();
  application.use("/api/v1/*", async (context, next) => {
    context.set("principal", { id: "test-user", role: principal });
    return next();
  });
  registerRunRoutes(application, {
    runs: {
      startRun: async () => ({ outcome: "created", run }),
      getRun: async () => run,
      listRunEvents: async () => ({ events: [] }),
      cancelRun: async () => run,
      listRunArtifacts: async () => [artifact],
      getRunArtifact: async () => ({
        artifact,
        content: "{}",
        truncated: false,
      }),
      ...protocol,
    },
  });
  return application;
}

async function request(
  application: Hono,
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await application.request(path, init);
  return { response, body: (await response.json()) as Record<string, unknown> };
}

const startBody = JSON.stringify({
  command: "build",
  project: { path: "/private/workspace/project" },
});

describe("run HTTP routes", () => {
  test("requires execute for starts and inspect for reads", async () => {
    const viewer = app("viewer");
    expect(
      (
        await request(viewer, "/api/v1/runs", {
          method: "POST",
          body: startBody,
        })
      ).response.status,
    ).toBe(403);
    expect(
      (await request(viewer, "/api/v1/runs/invocation-1")).response.status,
    ).toBe(200);
  });

  test("maps start outcomes and passes the idempotency key", async () => {
    const outcomes: StartRunResponse[] = [
      { outcome: "created", run },
      { outcome: "in_flight", run },
      { outcome: "replayed", run },
      { outcome: "conflict", reason: "idempotency_key_reused" },
    ];
    const keys: string[] = [];
    const application = app("operator", {
      startRun: async (input) => {
        keys.push(input.idempotencyKey);
        return outcomes.shift() ?? { outcome: "created", run };
      },
    });
    const statuses: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const result = await request(application, "/api/v1/runs", {
        method: "POST",
        headers: {
          "Idempotency-Key": `key-${index}`,
          "Content-Type": "application/json",
        },
        body: startBody,
      });
      statuses.push(result.response.status);
    }
    expect(statuses).toEqual([202, 202, 200, 409]);
    expect(keys).toEqual(["key-0", "key-1", "key-2", "key-3"]);
  });

  test("rejects missing idempotency keys and malformed payloads at the boundary", async () => {
    const application = app();
    expect(
      (
        await request(application, "/api/v1/runs", {
          method: "POST",
          body: startBody,
        })
      ).response.status,
    ).toBe(422);
    expect(
      (
        await request(application, "/api/v1/runs", {
          method: "POST",
          headers: { "Idempotency-Key": "key-1" },
          body: "not-json",
        })
      ).response.status,
    ).toBe(422);
  });

  test("parses event cursors and limits and maps missing runs", async () => {
    let eventsInput: { cursor?: string; limit?: number } | undefined;
    const application = app("viewer", {
      listRunEvents: async (input) => {
        eventsInput = input;
        return { events: [], nextCursor: "next" };
      },
      getRun: async () => {
        throw new Error("Run not found: missing");
      },
    });
    const events = await request(
      application,
      "/api/v1/runs/invocation-1/events?cursor=page-2&limit=25",
    );
    expect(events.response.status).toBe(200);
    expect(eventsInput).toMatchObject({
      invocationId: "invocation-1",
      cursor: "page-2",
      limit: 25,
    });
    const missing = await request(application, "/api/v1/runs/missing");
    expect(missing.response.status).toBe(404);
  });

  test("requires idempotency for cancellation and redacts path references", async () => {
    let cancellationKey: string | undefined;
    let artifactInput: { maxBytes?: number } | undefined;
    const application = app("operator", {
      cancelRun: async (input) => {
        cancellationKey = input.idempotencyKey;
        return run;
      },
      getRunArtifact: async (input) => {
        artifactInput = input;
        return { artifact, content: "{}", truncated: false };
      },
    });
    expect(
      (
        await request(application, "/api/v1/runs/invocation-1/cancel", {
          method: "POST",
        })
      ).response.status,
    ).toBe(422);
    const cancelled = await request(
      application,
      "/api/v1/runs/invocation-1/cancel",
      {
        method: "POST",
        headers: { "Idempotency-Key": "cancel-1" },
      },
    );
    expect(cancelled.response.status).toBe(202);
    expect(cancellationKey).toBe("cancel-1");
    const listed = await request(
      application,
      "/api/v1/runs/invocation-1/artifacts",
    );
    expect(JSON.stringify(listed.body)).not.toContain("/private/workspace");
    const content = await request(
      application,
      "/api/v1/runs/invocation-1/artifacts/artifact-1?maxBytes=10",
    );
    expect(content.response.status).toBe(200);
    expect(artifactInput).toMatchObject({
      invocationId: "invocation-1",
      artifactId: "artifact-1",
      maxBytes: 10,
    });
    expect(JSON.stringify(content.body)).not.toContain("/private/workspace");
  });
});
