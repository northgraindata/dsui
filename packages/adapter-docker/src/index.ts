import { spawn } from "node:child_process";
import http from "node:http";
import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";

type DockerLogLine = {
  timestamp: string;
  stream: string;
  line: string;
};

type ContainerInspect = {
  Id: string;
  Config?: { Image?: string };
  State?: { Status?: string };
};

const connectionSchema = z.object({
  container: z.string().min(1),
  strategy: z.enum(["cli", "api"]).default("cli"),
  dockerHost: z.string().optional(),
  tail: z.coerce.number().int().min(1).max(2000).default(200),
});

const logInput = z.object({
  tail: z.coerce.number().min(1).max(2000).optional(),
});

function inspectToInfo(inspect: ContainerInspect): {
  id: string;
  image: string;
  state: string;
} {
  return {
    id: inspect.Id,
    image: inspect.Config?.Image ?? "",
    state: inspect.State?.Status ?? "",
  };
}

export const dockerAdapter = defineAdapter({
  id: "docker",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "docker",
    name: "Docker",
    category: "Containers",
    description:
      "Stream logs from a single Docker container using the Docker CLI or the Engine API.",
    icon: "docker",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "container",
      label: "Container",
      type: "text",
      required: true,
      placeholder: "generator",
    },
    {
      id: "strategy",
      label: "Strategy",
      type: "select",
      placeholder: "cli",
      options: [
        { label: "Docker CLI", value: "cli" },
        { label: "Engine API", value: "api" },
      ],
    },
    {
      id: "dockerHost",
      label: "Docker host",
      type: "text",
      placeholder: "unix:///var/run/docker.sock",
    },
    { id: "tail", label: "Tail lines", type: "number", placeholder: "200" },
  ],
  secretPaths: [],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Container" },
    },
    {
      id: "logs",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 2000,
      view: {
        kind: "log-stream",
        title: "Logs",
        columns: [
          { id: "timestamp", label: "Time", format: "timestamp" },
          { id: "stream", label: "Stream", format: "text" },
          { id: "line", label: "Message", format: "code" },
        ],
      },
    },
  ],
  create(context, connection) {
    const strategy = connection.strategy ?? "cli";
    const container = connection.container;
    const defaultTail = connection.tail ?? 200;

    function runCli(args: string[]): Promise<string> {
      return new Promise((resolve, reject) => {
        const child = spawn("docker", args, { signal: context.signal });
        let out = "";
        child.stdout.on("data", (d) => (out += String(d)));
        child.stderr.on("data", (d) => (out += String(d)));
        child.on("error", (e) => reject(e));
        child.on("close", (code) => {
          if (code === 0) resolve(out);
          else
            reject(new Error(out.trim() || `docker ${args[0]} exited ${code}`));
        });
      });
    }

    function resolveHost(): {
      socketPath?: string;
      host?: string;
      port?: number;
    } {
      const raw =
        connection.dockerHost ??
        process.env.DOCKER_HOST ??
        "unix:///var/run/docker.sock";
      if (raw.startsWith("unix://")) {
        return { socketPath: raw.slice("unix://".length) };
      }
      if (raw.startsWith("tcp://")) {
        const url = new URL(raw);
        return { host: url.hostname, port: Number(url.port) || 2375 };
      }
      if (raw.startsWith("/")) return { socketPath: raw };
      return { socketPath: raw };
    }

    function apiGet(path: string): Promise<Buffer> {
      return new Promise((resolve, reject) => {
        const { socketPath, host, port } = resolveHost();
        const req = http.request(
          {
            socketPath,
            host,
            port,
            path,
            method: "GET",
            signal: context.signal,
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (c) => chunks.push(c as Buffer));
            res.on("end", () => resolve(Buffer.concat(chunks)));
          },
        );
        req.on("error", reject);
        if (context.signal) {
          context.signal.addEventListener("abort", () => req.destroy());
        }
        req.end();
      });
    }

    async function apiInspect(): Promise<ContainerInspect> {
      const raw = await apiGet(
        `/containers/${encodeURIComponent(container)}/json`,
      );
      return JSON.parse(raw.toString()) as ContainerInspect;
    }

    function demuxFrames(buffer: Buffer): DockerLogLine[] {
      const lines: DockerLogLine[] = [];
      const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );
      let offset = 0;
      while (offset + 8 <= buffer.length) {
        const streamType = buffer[offset];
        const size = view.getUint32(offset + 4);
        if (offset + 8 + size > buffer.length) break;
        const payload = buffer.subarray(offset + 8, offset + 8 + size);
        const text = Buffer.from(payload).toString("utf8");
        for (const raw of text.split("\n")) {
          if (raw.length === 0) continue;
          const space = raw.indexOf(" ");
          let timestamp = "";
          let message = raw;
          if (space > 0) {
            timestamp = raw.slice(0, space);
            message = raw.slice(space + 1);
          }
          lines.push({
            stream: streamType === 2 ? "stderr" : "stdout",
            timestamp,
            line: message,
          });
        }
        offset += 8 + size;
      }
      return lines;
    }

    function parseCliLogs(text: string): DockerLogLine[] {
      return text
        .split("\n")
        .filter((l) => l.length > 0)
        .map((raw) => {
          const space = raw.indexOf(" ");
          if (space > 0 && /^\d{4}-\d{2}-\d{2}/.test(raw.slice(0, space))) {
            return {
              timestamp: raw.slice(0, space),
              stream: "stdout",
              line: raw.slice(space + 1),
            };
          }
          return { timestamp: "", stream: "stdout", line: raw };
        });
    }

    async function inspect(): Promise<ContainerInspect> {
      if (strategy === "api") return apiInspect();
      const out = await runCli(["inspect", container]);
      const parsed = JSON.parse(out) as ContainerInspect[];
      const found = parsed[0];
      if (!found) throw new Error(`Container not found: ${container}`);
      return found;
    }

    return {
      async health() {
        const started = Date.now();
        try {
          const info = inspectToInfo(await inspect());
          return {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: `${info.state} · ${info.image}`,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: `Cannot reach container ${container}`,
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "service-info") {
          const info = inspectToInfo(await inspect());
          return {
            items: [
              { label: "Container", value: info.id, format: "code" },
              { label: "Image", value: info.image },
              { label: "State", value: info.state },
            ],
          };
        }
        if (operationId === "logs") {
          const parsed = logInput.parse(input);
          const limit = parsed.tail ?? defaultTail;
          let lines: DockerLogLine[];
          if (strategy === "api") {
            const buf = await apiGet(
              `/containers/${encodeURIComponent(container)}/logs?stdout=1&stderr=1&tail=${limit}&timestamps=1`,
            );
            lines = demuxFrames(buf);
          } else {
            const out = await runCli([
              "logs",
              "--tail",
              String(limit),
              "--timestamps",
              container,
            ]);
            lines = parseCliLogs(out);
          }
          return { items: lines };
        }
        throw new Error(`Unsupported Docker operation: ${operationId}`);
      },
    };
  },
});

export default dockerAdapter;
