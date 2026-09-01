import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  ADAPTER_SDK_VERSION,
  defineAdapter,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import {
  AclOperationTypes,
  AclPermissionTypes,
  AclResourceTypes,
  ConfigResourceTypes,
  Kafka,
  logLevel,
  ResourcePatternTypes,
  type SASLOptions,
} from "kafkajs";
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
    schemaRegistryUrl: z.string().url().optional(),
    schemaRegistryUsername: z.string().optional(),
    schemaRegistryPassword: z.string().optional(),
    connectUrls: z.array(z.string().url()).default([]),
    connectUsername: z.string().optional(),
    connectPassword: z.string().optional(),
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
  partition: z.coerce.number().int().min(0).optional(),
  filter: z.string().max(500).optional(),
});
const topicInput = z.object({ topic: z.string().min(1) });
const groupInput = z.object({ groupId: z.string().min(1) });
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
    { id: "schemaRegistryUrl", label: "Schema Registry URL", type: "url" },
    {
      id: "schemaRegistryUsername",
      label: "Schema Registry username",
      type: "text",
    },
    {
      id: "schemaRegistryPassword",
      label: "Schema Registry password",
      type: "password",
      secret: true,
    },
    {
      id: "connectUrls",
      label: "Kafka Connect URLs",
      type: "list",
      placeholder: "http://connect:8083",
    },
    { id: "connectUsername", label: "Kafka Connect username", type: "text" },
    {
      id: "connectPassword",
      label: "Kafka Connect password",
      type: "password",
      secret: true,
    },
  ],
  secretPaths: ["password", "schemaRegistryPassword", "connectPassword"],
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
      id: "brokers",
      authorization: "inspect",
      view: { kind: "service-info", title: "Brokers" },
    },
    {
      id: "broker-config",
      authorization: "inspect",
      view: { kind: "record-list", title: "Broker configuration" },
    },
    {
      id: "topic-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Topic detail" },
    },
    {
      id: "topic-config",
      authorization: "inspect",
      view: { kind: "record-list", title: "Topic configuration" },
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
      id: "consumer-group-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Consumer group detail" },
    },
    {
      id: "acls",
      authorization: "inspect",
      view: { kind: "record-list", title: "ACLs" },
    },
    {
      id: "partition-reassignments",
      authorization: "inspect",
      view: { kind: "record-list", title: "Partition reassignments" },
    },
    {
      id: "schema-subjects",
      authorization: "inspect",
      view: { kind: "record-list", title: "Schema subjects" },
    },
    {
      id: "schema-versions",
      authorization: "inspect",
      view: { kind: "record-list", title: "Schema versions" },
    },
    {
      id: "schema-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Schema" },
    },
    {
      id: "connectors",
      authorization: "inspect",
      view: { kind: "job-browser", title: "Kafka Connect" },
    },
    {
      id: "connector-detail",
      authorization: "inspect",
      view: { kind: "record-detail", title: "Connector detail" },
    },
    {
      id: "create-topic",
      authorization: "execute",
      view: { kind: "action-form", title: "Create topic" },
    },
    {
      id: "delete-topic",
      authorization: "execute",
      view: { kind: "action-form", title: "Delete topic" },
    },
    {
      id: "create-partitions",
      authorization: "execute",
      view: { kind: "action-form", title: "Add partitions" },
    },
    {
      id: "update-topic-config",
      authorization: "execute",
      view: { kind: "action-form", title: "Update topic configuration" },
    },
    {
      id: "delete-records",
      authorization: "execute",
      view: { kind: "action-form", title: "Delete records" },
    },
    {
      id: "produce-message",
      authorization: "execute",
      view: { kind: "action-form", title: "Produce message" },
    },
    {
      id: "reset-offsets",
      authorization: "execute",
      view: { kind: "action-form", title: "Reset consumer offsets" },
    },
    {
      id: "set-offsets",
      authorization: "execute",
      view: { kind: "action-form", title: "Set consumer offsets" },
    },
    {
      id: "delete-consumer-group",
      authorization: "execute",
      view: { kind: "action-form", title: "Delete consumer group" },
    },
    {
      id: "create-acl",
      authorization: "execute",
      view: { kind: "action-form", title: "Create ACL" },
    },
    {
      id: "delete-acl",
      authorization: "execute",
      view: { kind: "action-form", title: "Delete ACL" },
    },
    {
      id: "register-schema",
      authorization: "execute",
      view: { kind: "action-form", title: "Register schema" },
    },
    {
      id: "delete-schema",
      authorization: "execute",
      view: { kind: "action-form", title: "Delete schema" },
    },
    {
      id: "create-connector",
      authorization: "execute",
      view: { kind: "action-form", title: "Create connector" },
    },
    {
      id: "update-connector",
      authorization: "execute",
      view: { kind: "action-form", title: "Update connector" },
    },
    {
      id: "connector-action",
      authorization: "execute",
      view: { kind: "action-form", title: "Control connector" },
    },
    {
      id: "metrics",
      authorization: "inspect",
      view: { kind: "service-info", title: "Metrics" },
    },
  ],
  create(context, connection) {
    const kafka = createKafka(connection);
    const fetchFn = context.fetch ?? fetch;
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
    function basic(
      username?: string,
      password?: string,
    ): Record<string, string> {
      return username && password
        ? {
            Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
          }
        : {};
    }
    async function rest<T>(
      baseUrl: string,
      path: string,
      auth: Record<string, string>,
      init?: RequestInit,
    ): Promise<T> {
      const response = await fetchFn(`${baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...auth,
          ...(init?.headers ?? {}),
        },
        signal: context.signal,
      });
      if (response.status === 204) return {} as T;
      const body = (await response.json().catch(() => ({}))) as T & {
        error_code?: number;
        message?: string;
        errorMessage?: string;
      };
      if (!response.ok)
        throw new Error(
          body.message ??
            body.errorMessage ??
            `Kafka companion service responded ${response.status}`,
        );
      return body;
    }
    function registry<T>(path: string, init?: RequestInit): Promise<T> {
      if (!connection.schemaRegistryUrl)
        throw new Error("Schema Registry URL is not configured");
      return rest(
        connection.schemaRegistryUrl,
        path,
        basic(
          connection.schemaRegistryUsername,
          connection.schemaRegistryPassword,
        ),
        init,
      );
    }
    function connectBase(requested?: string): string {
      const selected = requested ?? connection.connectUrls[0];
      if (!selected || !connection.connectUrls.includes(selected))
        throw new Error("A configured Kafka Connect URL is required");
      return selected;
    }
    function connect<T>(baseUrl: string, path: string, init?: RequestInit) {
      return rest<T>(
        baseUrl,
        path,
        basic(connection.connectUsername, connection.connectPassword),
        init,
      );
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
            const cluster = await admin.describeCluster();
            return {
              items: [
                {
                  label: "Bootstrap brokers",
                  value: connection.brokers.join(", "),
                  format: "code",
                },
                { label: "Topics", value: String(metadata.topics.length) },
                {
                  label: "Cluster ID",
                  value: cluster.clusterId,
                  format: "code",
                },
                {
                  label: "Controller",
                  value: String(cluster.controller ?? "unknown"),
                },
                { label: "Brokers", value: String(cluster.brokers.length) },
                {
                  label: "Schema Registry",
                  value: connection.schemaRegistryUrl ?? "Not configured",
                },
                {
                  label: "Kafka Connect clusters",
                  value: String(connection.connectUrls.length),
                },
              ],
            };
          });
        if (operationId === "brokers")
          return withAdmin(async (admin) => {
            const cluster = await admin.describeCluster();
            return {
              items: cluster.brokers.map((broker) => ({
                id: broker.nodeId,
                host: broker.host,
                port: broker.port,
                controller: broker.nodeId === cluster.controller,
                clusterId: cluster.clusterId,
              })),
            };
          });
        if (operationId === "broker-config")
          return withAdmin(async (admin) => {
            const { brokerId } = z
              .object({ brokerId: z.coerce.number().int().min(0) })
              .parse(input);
            const result = await admin.describeConfigs({
              resources: [
                { type: ConfigResourceTypes.BROKER, name: String(brokerId) },
              ],
              includeSynonyms: true,
            });
            return { items: result.resources[0]?.configEntries ?? [] };
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
        if (operationId === "topic-detail")
          return withAdmin(async (admin) => {
            const { topic } = topicInput.parse(input);
            const [metadata, offsets, configs] = await Promise.all([
              admin.fetchTopicMetadata({ topics: [topic] }),
              admin.fetchTopicOffsets(topic),
              admin.describeConfigs({
                resources: [{ type: ConfigResourceTypes.TOPIC, name: topic }],
                includeSynonyms: true,
              }),
            ]);
            const item = metadata.topics[0];
            if (!item) throw new Error(`Topic not found: ${topic}`);
            return {
              items: item.partitions.map((partition) => {
                const position = offsets.find(
                  (offset) => offset.partition === partition.partitionId,
                );
                return {
                  topic,
                  partition: partition.partitionId,
                  leader: partition.leader,
                  replicas: partition.replicas,
                  inSyncReplicas: partition.isr,
                  lowOffset: position?.low,
                  highOffset: position?.high,
                };
              }),
              config: configs.resources[0]?.configEntries ?? [],
            };
          });
        if (operationId === "topic-config")
          return withAdmin(async (admin) => {
            const { topic } = topicInput.parse(input);
            const result = await admin.describeConfigs({
              resources: [{ type: ConfigResourceTypes.TOPIC, name: topic }],
              includeSynonyms: true,
            });
            return { items: result.resources[0]?.configEntries ?? [] };
          });
        if (operationId === "create-topic")
          return withAdmin(async (admin) => {
            const parsed = z
              .object({
                topic: z.string().min(1),
                partitions: z.coerce.number().int().positive().default(1),
                replicationFactor: z.coerce
                  .number()
                  .int()
                  .positive()
                  .default(1),
                config: z.record(z.string()).default({}),
                validateOnly: z.boolean().default(false),
              })
              .parse(input);
            const created = await admin.createTopics({
              validateOnly: parsed.validateOnly,
              waitForLeaders: true,
              topics: [
                {
                  topic: parsed.topic,
                  numPartitions: parsed.partitions,
                  replicationFactor: parsed.replicationFactor,
                  configEntries: Object.entries(parsed.config).map(
                    ([name, value]) => ({ name, value }),
                  ),
                },
              ],
            });
            return { created };
          });
        if (operationId === "delete-topic")
          return withAdmin(async (admin) => {
            const { topic } = topicInput.parse(input);
            await admin.deleteTopics({ topics: [topic] });
            return { deleted: topic };
          });
        if (operationId === "create-partitions")
          return withAdmin(async (admin) => {
            const parsed = z
              .object({
                topic: z.string().min(1),
                count: z.coerce.number().int().positive(),
                validateOnly: z.boolean().default(false),
              })
              .parse(input);
            const changed = await admin.createPartitions({
              validateOnly: parsed.validateOnly,
              topicPartitions: [{ topic: parsed.topic, count: parsed.count }],
            });
            return { changed };
          });
        if (operationId === "update-topic-config")
          return withAdmin(async (admin) => {
            const parsed = z
              .object({
                topic: z.string().min(1),
                config: z.record(z.string()),
                validateOnly: z.boolean().default(false),
              })
              .parse(input);
            await admin.alterConfigs({
              validateOnly: parsed.validateOnly,
              resources: [
                {
                  type: ConfigResourceTypes.TOPIC,
                  name: parsed.topic,
                  configEntries: Object.entries(parsed.config).map(
                    ([name, value]) => ({ name, value }),
                  ),
                },
              ],
            });
            return { updated: parsed.topic };
          });
        if (operationId === "delete-records")
          return withAdmin(async (admin) => {
            const parsed = z
              .object({
                topic: z.string().min(1),
                partitions: z
                  .array(
                    z.object({
                      partition: z.coerce.number().int().min(0),
                      offset: z.coerce.string(),
                    }),
                  )
                  .min(1),
              })
              .parse(input);
            await admin.deleteTopicRecords(parsed);
            return { deletedBefore: parsed.partitions };
          });
        if (operationId === "partition-reassignments")
          return withAdmin(async (admin) => {
            const result = await admin.listPartitionReassignments({});
            return {
              items: result.topics.flatMap((topic) =>
                topic.partitions.map((partition) => ({
                  topic: topic.topic,
                  ...partition,
                })),
              ),
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
        if (operationId === "consumer-group-detail")
          return withAdmin(async (admin) => {
            const { groupId } = groupInput.parse(input);
            const [description, offsets] = await Promise.all([
              admin.describeGroups([groupId]),
              admin.fetchOffsets({ groupId, resolveOffsets: true }),
            ]);
            const group = description.groups[0];
            return {
              items: offsets.flatMap((topic) =>
                topic.partitions.map((partition) => ({
                  groupId,
                  topic: topic.topic,
                  partition: partition.partition,
                  offset: partition.offset,
                  metadata: partition.metadata,
                })),
              ),
              group,
            };
          });
        if (operationId === "reset-offsets")
          return withAdmin(async (admin) => {
            const parsed = z
              .object({
                groupId: z.string().min(1),
                topic: z.string().min(1),
                position: z.enum(["earliest", "latest"]),
              })
              .parse(input);
            await admin.resetOffsets({
              groupId: parsed.groupId,
              topic: parsed.topic,
              earliest: parsed.position === "earliest",
            });
            return { reset: parsed.position };
          });
        if (operationId === "set-offsets")
          return withAdmin(async (admin) => {
            const parsed = z
              .object({
                groupId: z.string().min(1),
                topic: z.string().min(1),
                partitions: z
                  .array(
                    z.object({
                      partition: z.coerce.number().int().min(0),
                      offset: z.coerce.string(),
                    }),
                  )
                  .min(1),
              })
              .parse(input);
            await admin.setOffsets(parsed);
            return { updated: parsed.partitions };
          });
        if (operationId === "delete-consumer-group")
          return withAdmin(async (admin) => {
            const { groupId } = groupInput.parse(input);
            return { items: await admin.deleteGroups([groupId]) };
          });
        if (operationId === "acls")
          return withAdmin(async (admin) => {
            const result = await admin.describeAcls({
              resourceType: AclResourceTypes.ANY,
              resourcePatternType: ResourcePatternTypes.ANY,
              operation: AclOperationTypes.ANY,
              permissionType: AclPermissionTypes.ANY,
            });
            return {
              items: result.resources.flatMap((resource) =>
                resource.acls.map((acl) => ({
                  ...resource,
                  acls: undefined,
                  ...acl,
                })),
              ),
            };
          });
        if (operationId === "create-acl" || operationId === "delete-acl")
          return withAdmin(async (admin) => {
            const resourceTypes = {
              topic: AclResourceTypes.TOPIC,
              group: AclResourceTypes.GROUP,
              cluster: AclResourceTypes.CLUSTER,
              transactionalId: AclResourceTypes.TRANSACTIONAL_ID,
            } as const;
            const operations = {
              all: AclOperationTypes.ALL,
              read: AclOperationTypes.READ,
              write: AclOperationTypes.WRITE,
              create: AclOperationTypes.CREATE,
              delete: AclOperationTypes.DELETE,
              alter: AclOperationTypes.ALTER,
              describe: AclOperationTypes.DESCRIBE,
              clusterAction: AclOperationTypes.CLUSTER_ACTION,
              describeConfigs: AclOperationTypes.DESCRIBE_CONFIGS,
              alterConfigs: AclOperationTypes.ALTER_CONFIGS,
              idempotentWrite: AclOperationTypes.IDEMPOTENT_WRITE,
            } as const;
            const patterns = {
              literal: ResourcePatternTypes.LITERAL,
              prefixed: ResourcePatternTypes.PREFIXED,
              any: ResourcePatternTypes.ANY,
              match: ResourcePatternTypes.MATCH,
            } as const;
            const parsed = z
              .object({
                resourceType: z.enum([
                  "topic",
                  "group",
                  "cluster",
                  "transactionalId",
                ]),
                resourceName: z.string().min(1),
                pattern: z
                  .enum(["literal", "prefixed", "any", "match"])
                  .default("literal"),
                principal: z.string().min(1),
                host: z.string().default("*"),
                operation: z.enum([
                  "all",
                  "read",
                  "write",
                  "create",
                  "delete",
                  "alter",
                  "describe",
                  "clusterAction",
                  "describeConfigs",
                  "alterConfigs",
                  "idempotentWrite",
                ]),
                permission: z.enum(["allow", "deny"]),
              })
              .parse(input);
            const acl = {
              resourceType: resourceTypes[parsed.resourceType],
              resourceName: parsed.resourceName,
              resourcePatternType: patterns[parsed.pattern],
              principal: parsed.principal,
              host: parsed.host,
              operation: operations[parsed.operation],
              permissionType:
                parsed.permission === "allow"
                  ? AclPermissionTypes.ALLOW
                  : AclPermissionTypes.DENY,
            };
            if (operationId === "create-acl")
              return { created: await admin.createAcls({ acl: [acl] }) };
            return admin.deleteAcls({ filters: [acl] });
          });
        if (operationId === "produce-message") {
          const parsed = z
            .object({
              topic: z.string().min(1),
              key: z.string().optional(),
              value: z.string(),
              partition: z.coerce.number().int().min(0).optional(),
              headers: z.record(z.string()).default({}),
            })
            .parse(input);
          const producer = kafka.producer({ allowAutoTopicCreation: false });
          await producer.connect();
          try {
            return {
              items: await producer.send({
                topic: parsed.topic,
                messages: [
                  {
                    key: parsed.key,
                    value: parsed.value,
                    partition: parsed.partition,
                    headers: parsed.headers,
                  },
                ],
              }),
            };
          } finally {
            await producer.disconnect();
          }
        }
        if (operationId === "schema-subjects") {
          const subjects = await registry<string[]>("/subjects");
          return { items: subjects.map((subject) => ({ subject })) };
        }
        if (operationId === "schema-versions") {
          const { subject } = z
            .object({ subject: z.string().min(1) })
            .parse(input);
          const versions = await registry<Array<number | string>>(
            `/subjects/${encodeURIComponent(subject)}/versions`,
          );
          return { items: versions.map((version) => ({ subject, version })) };
        }
        if (operationId === "schema-detail") {
          const parsed = z
            .object({
              subject: z.string().min(1),
              version: z
                .union([
                  z.literal("latest"),
                  z.coerce.number().int().positive(),
                ])
                .default("latest"),
            })
            .parse(input);
          return registry(
            `/subjects/${encodeURIComponent(parsed.subject)}/versions/${parsed.version}`,
          );
        }
        if (operationId === "register-schema") {
          const parsed = z
            .object({
              subject: z.string().min(1),
              schema: z.string().min(1),
              schemaType: z.enum(["AVRO", "JSON", "PROTOBUF"]).default("AVRO"),
              references: z
                .array(
                  z.object({
                    name: z.string(),
                    subject: z.string(),
                    version: z.coerce.number().int().positive(),
                  }),
                )
                .default([]),
              normalize: z.boolean().default(false),
            })
            .parse(input);
          return registry(
            `/subjects/${encodeURIComponent(parsed.subject)}/versions?normalize=${parsed.normalize}`,
            {
              method: "POST",
              body: JSON.stringify({
                schema: parsed.schema,
                schemaType: parsed.schemaType,
                references: parsed.references,
              }),
            },
          );
        }
        if (operationId === "delete-schema") {
          const parsed = z
            .object({
              subject: z.string().min(1),
              version: z
                .union([z.literal("all"), z.coerce.number().int().positive()])
                .default("all"),
              permanent: z.boolean().default(false),
            })
            .parse(input);
          const suffix =
            parsed.version === "all" ? "" : `/versions/${parsed.version}`;
          return registry(
            `/subjects/${encodeURIComponent(parsed.subject)}${suffix}?permanent=${parsed.permanent}`,
            { method: "DELETE" },
          );
        }
        if (operationId === "connectors") {
          const clusters = await Promise.all(
            connection.connectUrls.map(async (baseUrl) => {
              const result = await connect<
                Record<string, { info?: unknown; status?: unknown }>
              >(baseUrl, "/connectors?expand=info&expand=status");
              return Object.entries(result).map(([name, detail]) => ({
                cluster: baseUrl,
                name,
                info: detail.info,
                status: detail.status,
              }));
            }),
          );
          return { items: clusters.flat() };
        }
        if (operationId === "connector-detail") {
          const parsed = z
            .object({
              name: z.string().min(1),
              cluster: z.string().url().optional(),
            })
            .parse(input);
          const baseUrl = connectBase(parsed.cluster);
          const [info, status, config, topics] = await Promise.all([
            connect(baseUrl, `/connectors/${encodeURIComponent(parsed.name)}`),
            connect(
              baseUrl,
              `/connectors/${encodeURIComponent(parsed.name)}/status`,
            ),
            connect(
              baseUrl,
              `/connectors/${encodeURIComponent(parsed.name)}/config`,
            ),
            connect(
              baseUrl,
              `/connectors/${encodeURIComponent(parsed.name)}/topics`,
            ).catch(() => ({})),
          ]);
          return { info, status, config, topics };
        }
        if (operationId === "create-connector") {
          const parsed = z
            .object({
              name: z.string().min(1),
              config: z.record(z.unknown()),
              cluster: z.string().url().optional(),
            })
            .parse(input);
          return connect(connectBase(parsed.cluster), "/connectors", {
            method: "POST",
            body: JSON.stringify({ name: parsed.name, config: parsed.config }),
          });
        }
        if (operationId === "update-connector") {
          const parsed = z
            .object({
              name: z.string().min(1),
              config: z.record(z.unknown()),
              cluster: z.string().url().optional(),
            })
            .parse(input);
          return connect(
            connectBase(parsed.cluster),
            `/connectors/${encodeURIComponent(parsed.name)}/config`,
            { method: "PUT", body: JSON.stringify(parsed.config) },
          );
        }
        if (operationId === "connector-action") {
          const parsed = z
            .object({
              name: z.string().min(1),
              action: z.enum([
                "pause",
                "resume",
                "stop",
                "restart",
                "delete",
                "restart-task",
              ]),
              taskId: z.coerce.number().int().min(0).optional(),
              includeTasks: z.boolean().default(true),
              onlyFailed: z.boolean().default(false),
              cluster: z.string().url().optional(),
            })
            .parse(input);
          const baseUrl = connectBase(parsed.cluster);
          if (parsed.action === "delete")
            return connect(
              baseUrl,
              `/connectors/${encodeURIComponent(parsed.name)}`,
              { method: "DELETE" },
            );
          if (parsed.action === "restart-task") {
            if (parsed.taskId == null)
              throw new Error("taskId is required for restart-task");
            return connect(
              baseUrl,
              `/connectors/${encodeURIComponent(parsed.name)}/tasks/${parsed.taskId}/restart`,
              { method: "POST", body: "{}" },
            );
          }
          const query =
            parsed.action === "restart"
              ? `?includeTasks=${parsed.includeTasks}&onlyFailed=${parsed.onlyFailed}`
              : "";
          return connect(
            baseUrl,
            `/connectors/${encodeURIComponent(parsed.name)}/${parsed.action}${query}`,
            { method: parsed.action === "stop" ? "PUT" : "POST", body: "{}" },
          );
        }
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
          const {
            topic,
            limit,
            fromBeginning,
            timeoutMs,
            partition: requestedPartition,
            filter,
          } = messagesInput.parse(input);
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
                const key = text(message.key);
                const value = text(message.value);
                if (
                  (requestedPartition !== undefined &&
                    requestedPartition !== partition) ||
                  (filter &&
                    !`${key ?? ""}\n${value ?? ""}`
                      .toLocaleLowerCase()
                      .includes(filter.toLocaleLowerCase()))
                )
                  return;
                if (items.length < limit)
                  items.push({
                    partition,
                    offset: message.offset,
                    timestamp: Number(message.timestamp),
                    key,
                    value,
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
