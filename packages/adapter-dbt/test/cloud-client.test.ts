import { describe, expect, test } from "bun:test";
import {
  createDbtCloudClient,
  DbtCloudApiError,
  dbtCloudRoutes,
} from "../src/index.js";

const config = {
  method: "cloud" as const,
  baseUrl: "https://emea.dbt.com/api/v3/",
  accountId: "account/1",
  apiToken: { secretRef: "secret/dbt-cloud-token" },
};

function response(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("dbt Cloud client", () => {
  test("resolves a bearer token and sends the exact v3 discovery request", async () => {
    const requests: Request[] = [];
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return response({ data: { id: 7, name: "Analytics", status: "active" } });
    };
    const client = createDbtCloudClient(config, {
      secretResolver: {
        resolve: async (ref) =>
          ref === config.apiToken.secretRef ? "token-value" : "wrong",
      },
      fetch: fetchFn,
    });

    await expect(client.getAccount()).resolves.toMatchObject({
      id: 7,
      status: "active",
    });
    expect(requests[0]?.url).toBe(
      "https://emea.dbt.com/api/v3/accounts/account%2F1/",
    );
    expect(requests[0]?.method).toBe("GET");
    expect(requests[0]?.headers.get("authorization")).toBe(
      "Bearer token-value",
    );
    expect(requests[0]?.headers.get("accept")).toBe("application/json");
    expect(requests[0]?.headers.get("content-type")).toBeNull();
    expect(client.baseUrl).toBe("https://emea.dbt.com");
  });

  test("uses v3 for discovery and v2 for job execution routes", () => {
    expect(dbtCloudRoutes.projects("1")).toBe("/api/v3/accounts/1/projects/");
    expect(dbtCloudRoutes.environments("1")).toBe(
      "/api/v3/accounts/1/environments/",
    );
    expect(dbtCloudRoutes.jobs("1")).toBe("/api/v2/accounts/1/jobs/");
    expect(dbtCloudRoutes.triggerJob("1", 2)).toBe(
      "/api/v2/accounts/1/jobs/2/run/",
    );
    expect(dbtCloudRoutes.retryRun("1", 3)).toBe(
      "/api/v2/accounts/1/runs/3/retry/",
    );
    expect(dbtCloudRoutes.runArtifact("1", 3, "manifest.json")).toBe(
      "/api/v2/accounts/1/runs/3/artifacts/manifest.json",
    );
  });

  test("serializes state-changing request bodies and query pagination", async () => {
    const requests: Request[] = [];
    const client = createDbtCloudClient(
      { ...config, baseUrl: "https://cloud.getdbt.com/region/" },
      {
        secretResolver: { resolve: async () => "token" },
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          requests.push(new Request(input, init));
          return response(
            input.toString().includes("runs")
              ? { data: [] }
              : { data: { id: 9 } },
          );
        },
      },
    );
    await client.triggerJob(9, { cause: "manual", status: "queued" });
    await client.listRuns({ limit: 25, offset: 50 });
    expect(requests[0]?.method).toBe("POST");
    expect(await requests[0]?.json()).toEqual({
      cause: "manual",
      status: "queued",
    });
    expect(requests[0]?.headers.get("content-type")).toBe("application/json");
    expect(requests[1]?.url).toContain(
      "/api/v2/accounts/account%2F1/runs/?limit=25&offset=50",
    );
  });

  test("rejects malformed provider responses", async () => {
    const client = createDbtCloudClient(config, {
      secretResolver: { resolve: async () => "token" },
      fetch: async () => response({ data: { name: "missing id" } }),
    });
    await expect(client.getProject(1)).rejects.toThrow(
      "Invalid dbt Cloud response",
    );
  });

  test("exposes structured provider errors without credentials", async () => {
    const token = "super-secret-token";
    const client = createDbtCloudClient(
      { ...config, apiToken: { value: token } },
      {
        secretResolver: { resolve: async () => token },
        fetch: async () =>
          response(
            { status: "denied", message: `no ${token}`, nested: token },
            { status: 403, statusText: "Forbidden" },
          ),
      },
    );
    try {
      await client.getAccount();
      throw new Error("expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(DbtCloudApiError);
      expect(error).toMatchObject({
        status: 403,
        providerStatus: "denied",
        providerMessage: "no [REDACTED]",
      });
      expect(JSON.stringify(error)).not.toContain(token);
      expect((error as Error).message).not.toContain(token);
    }
  });

  test("propagates caller abort signals to fetch", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const client = createDbtCloudClient(config, {
      secretResolver: { resolve: async () => "token" },
      fetch: async (_input, init) => {
        requestSignal = init?.signal as AbortSignal;
        await new Promise((resolve) => setTimeout(resolve, 50));
        throw new DOMException("The operation was aborted", "AbortError");
      },
    });
    const pending = client.getAccount({ signal: controller.signal });
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(requestSignal?.aborted).toBe(true);
  });
});
