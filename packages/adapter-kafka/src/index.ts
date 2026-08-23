import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { Kafka, logLevel, type SASLOptions } from "kafkajs";
import { lz4Decompress } from "./lz4";

// The bundled kafkajs build disables the LZ4/Snappy/ZSTD codecs (they throw
// "not implemented"), so we inject a pure-JS LZ4 decompressor into kafkajs'
// shared compression registry. This lets the consumer read LZ4-compressed
// topics (common with Kafka defaults) instead of crashing on the first batch.
try {
  const require = createRequire(import.meta.url);
  const compression = require("kafkajs/src/protocol/message/compression");
  compression.Codecs[compression.Types.LZ4] = () => ({
    async compress(): Promise<Buffer> {
      throw new Error("LZ4 compression is not supported by dsui");
    },
    async decompress(buffer: Buffer): Promise<Buffer> {
      return Buffer.from(lz4Decompress(buffer));
    },
  });
} catch {
  // If kafkajs' internals change, leave the codec as-is rather than breaking load.
}

const connectionSchema = z
  .object({
    brokers: z.array(z.string().min(3)).min(1),
    clientId: z.string().min(1).default("dsui"),
    ssl: z.boolean().default(false),
    saslMechanism: z
      .enum(["plain", "scram-sha-256", "scram-sha-512"])
      .optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.saslMechanism && (!value.username || !value.password))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SASL requires username and password",
      });
  });
type Connection = z.output<typeof connectionSchema>;
const pageInput = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
const messagesInput = pageInput.extend({
  topic: z.string().min(1),
  fromBeginning: z.boolean().default(false),
  timeoutMs: z.coerce.number().int().min(250).max(15_000).default(5_000),
});
function createKafka(connection: Connection) {
  const sasl: SASLOptions | undefined =
    connection.saslMechanism && connection.username && connection.password
      ? {
          mechanism: connection.saslMechanism,
          username: connection.username,
          password: connection.password,
        }
      : undefined;
  return new Kafka({
    clientId: connection.clientId,
    brokers: connection.brokers,
    ssl: connection.ssl,
    sasl,
    logLevel: logLevel.NOTHING,
  });
}
function text(value: Buffer | string | null | undefined): string | undefined {
  return value == null
    ? undefined
    : typeof value === "string"
      ? value
      : value.toString("utf8");
}

export const kafkaAdapter = defineAdapter({
  id: "kafka",
  version: "0.1.0",
  sdkVersion: ADAPTER_SDK_VERSION,
  metadata: {
    id: "kafka",
    name: "Kafka",
    category: "Streaming",
    description: "Inspect Kafka topics, messages and consumer groups.",
    icon: "kafka",
  },
  connectionSchema,
  connectionFields: [
    {
      id: "brokers",
      label: "Brokers",
      type: "list",
      required: true,
      placeholder: "kafka:9092",
    },
    { id: "ssl", label: "TLS", type: "boolean" },
    {
      id: "saslMechanism",
      label: "SASL mechanism",
      type: "select",
      options: [
        { label: "PLAIN", value: "plain" },
        { label: "SCRAM-SHA-256", value: "scram-sha-256" },
        { label: "SCRAM-SHA-512", value: "scram-sha-512" },
      ],
    },
    { id: "username", label: "Username", type: "text" },
    { id: "password", label: "Password", type: "password", secret: true },
  ],
  secretPaths: ["password"],
  capabilities: [
    {
      id: "service-info",
      authorization: "inspect",
      view: { kind: "service-info", title: "Cluster" },
    },
    {
      id: "topics",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: {
        kind: "topic-browser",
        title: "Topics",
        columns: [
          { id: "name", label: "Topic", format: "code" },
          { id: "partitions", label: "Partitions", format: "number" },
        ],
      },
    },
    {
      id: "messages",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: {
        kind: "message-browser",
        title: "Messages",
        columns: [
          { id: "partition", label: "Partition", format: "number" },
          { id: "offset", label: "Offset", format: "code" },
          { id: "timestamp", label: "Timestamp", format: "timestamp" },
        ],
      },
    },
    {
      id: "consumer-groups",
      authorization: "inspect",
      supportsPagination: true,
      maxPageSize: 100,
      view: { kind: "consumer-groups", title: "Consumer groups" },
    },
    {
      id: "metrics",
      authorization: "inspect",
      view: { kind: "service-info", title: "Metrics" },
    },
  ],
  create(context, connection) {
    const kafka = createKafka(connection);
    async function withAdmin<T>(
      work: (admin: ReturnType<Kafka["admin"]>) => Promise<T>,
    ): Promise<T> {
      const admin = kafka.admin();
      await admin.connect();
      try {
        return await work(admin);
      } finally {
        await admin.disconnect();
      }
    }
    return {
      async health() {
        const started = Date.now();
        try {
          const metadata = await withAdmin((admin) =>
            admin.fetchTopicMetadata(),
          );
          return {
            status: "healthy",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: `${metadata.topics.length} topic${metadata.topics.length === 1 ? "" : "s"}`,
          };
        } catch {
          return {
            status: "unavailable",
            checkedAt: new Date().toISOString(),
            latencyMs: Date.now() - started,
            detail: "Unable to connect to Kafka",
          };
        }
      },
      async execute(operationId, input) {
        if (operationId === "service-info")
          return withAdmin(async (admin) => {
            const metadata = await admin.fetchTopicMetadata();
            return {
              items: [
                {
                  label: "Bootstrap brokers",
                  value: connection.brokers.join(", "),
                  format: "code",
                },
                { label: "Topics", value: String(metadata.topics.length) },
              ],
            };
          });
        if (operationId === "topics")
          return withAdmin(async (admin) => {
            const { limit } = pageInput.parse(input);
            const metadata = await admin.fetchTopicMetadata();
            const topics = metadata.topics.sort((a, b) =>
              a.name.localeCompare(b.name),
            );
            const items = topics.slice(0, limit).map((topic) => ({
              name: topic.name,
              partitions: topic.partitions.length,
            }));
            return {
              items,
              nextCursor:
                topics.length > items.length ? "unsupported" : undefined,
            };
          });
        if (operationId === "consumer-groups")
          return withAdmin(async (admin) => {
            const { limit } = pageInput.parse(input);
            const listed = await admin.listGroups();
            const groupIds = listed.groups
              .slice(0, limit)
              .map((group) => group.groupId);
            const descriptions = groupIds.length
              ? await admin.describeGroups(groupIds)
              : { groups: [] };
            return {
              items: descriptions.groups.map((group) => ({
                id: group.groupId,
                state: group.state,
                protocol: group.protocol,
                members: group.members.length,
              })),
              nextCursor:
                listed.groups.length > groupIds.length
                  ? "unsupported"
                  : undefined,
            };
          });
        if (operationId === "metrics")
          return withAdmin(async (admin) => {
            const metadata = await admin.fetchTopicMetadata();
            const topics = metadata.topics;
            const partitions = topics.reduce(
              (sum, topic) => sum + topic.partitions.length,
              0,
            );
            let groups = 0;
            try {
              groups = (await admin.listGroups()).groups.length;
            } catch {
              groups = 0;
            }
            return {
              items: [
                { label: "Topics", value: topics.length },
                { label: "Partitions", value: partitions },
                { label: "Consumer groups", value: groups },
              ],
              columns: ["label", "value"],
            };
          });
        if (operationId === "messages") {
          const { topic, limit, fromBeginning, timeoutMs } =
            messagesInput.parse(input);
          const consumer = kafka.consumer({
            groupId: `dsui-preview-${randomUUID()}`,
            allowAutoTopicCreation: false,
          });
          const items: Array<Record<string, unknown>> = [];
          let done!: () => void;
          const finished = new Promise<void>((resolve) => {
            done = resolve;
          });
          const timeout = setTimeout(done, timeoutMs);
          try {
            await consumer.connect();
            await consumer.subscribe({ topic, fromBeginning });
            await consumer.run({
              autoCommit: false,
              eachMessage: async ({ partition, message }) => {
                if (items.length < limit)
                  items.push({
                    partition,
                    offset: message.offset,
                    timestamp: Number(message.timestamp),
                    key: text(message.key),
                    value: text(message.value),
                    headers: Object.fromEntries(
                      Object.entries(message.headers ?? {}).map(
                        ([key, value]) => {
                          const first = Array.isArray(value)
                            ? (value[0] ?? null)
                            : value;
                          return [key, first ? text(first) : undefined];
                        },
                      ),
                    ),
                  });
                if (items.length >= limit) done();
              },
            });
            await Promise.race([
              finished,
              new Promise<void>((_, reject) =>
                context.signal?.addEventListener(
                  "abort",
                  () => reject(new DOMException("Aborted", "AbortError")),
                  { once: true },
                ),
              ),
            ]);
            await consumer.stop();
            return { items };
          } finally {
            clearTimeout(timeout);
            await consumer.disconnect().catch(() => undefined);
          }
        }
        throw new Error(`Unsupported Kafka operation: ${operationId}`);
      },
    };
  },
});
export default kafkaAdapter;
