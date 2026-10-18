import {
  type ActionRuntimeContext,
  defineAction,
  definePage,
  Form,
  PageHeader,
  Select,
  Tabs,
  TextInput,
  z,
} from "@northgraindata/dsui-adapter-sdk";
import { qualified } from "./client.js";
import type { ClickHouseContext } from "./context.js";
import { catalogResources } from "./resources.js";
import { quoteIdentifier, validateSql } from "./sql.js";

type Context = ClickHouseContext & ActionRuntimeContext;
const base = {
  database: z.string().min(1),
  name: z.string().min(1),
  cluster: z.string().default(""),
  confirmTarget: z.string().min(1),
};
function clusterClause(cluster: string) {
  return cluster ? ` ON CLUSTER ${quoteIdentifier(cluster)}` : "";
}
function confirm(
  input: { database: string; name: string; confirmTarget: string },
  ctx: Context,
) {
  if (ctx.config.readOnly)
    throw new Error("This connection is configured read-only.");
  if (input.confirmTarget !== `${input.database}.${input.name}`)
    throw new Error("Type database.name exactly to confirm the target.");
}
async function executeCommand(sql: string, database: string, ctx: Context) {
  validateSql(sql);
  const result = await ctx.client.execute(sql, {
    database,
    signal: ctx.signal,
  });
  for (const resource of catalogResources) ctx.invalidate(resource);
  return {
    ...result,
    status: "submitted",
    detail:
      "Inspect the object and operations pages to verify completion, including distributed DDL or mutations.",
  };
}
export const createTableInput = z.object({
  ...base,
  columns: z.string().min(1).max(50_000),
  engine: z.enum([
    "MergeTree",
    "ReplacingMergeTree",
    "SummingMergeTree",
    "AggregatingMergeTree",
    "CollapsingMergeTree",
    "VersionedCollapsingMergeTree",
    "ReplicatedMergeTree",
    "ReplicatedReplacingMergeTree",
    "Distributed",
    "Memory",
    "Log",
    "TinyLog",
    "StripeLog",
  ]),
  engineArguments: z.string().default(""),
  orderBy: z.string().default(""),
  partitionBy: z.string().default(""),
  ttl: z.string().default(""),
  settings: z.string().default(""),
});
export function createTableSql(input: z.output<typeof createTableInput>) {
  const mergeTree = input.engine.includes("MergeTree");
  if (!mergeTree && (input.orderBy || input.partitionBy || input.ttl))
    throw new Error(
      "Sorting, partition and TTL fields require a MergeTree engine.",
    );
  if (
    [
      "Distributed",
      "CollapsingMergeTree",
      "VersionedCollapsingMergeTree",
    ].includes(input.engine) &&
    !input.engineArguments
  )
    throw new Error("This engine requires engine arguments.");
  const sql = `CREATE TABLE ${qualified(input.database, input.name)}${clusterClause(input.cluster)} (${input.columns}) ENGINE = ${input.engine}(${input.engineArguments})${input.partitionBy ? ` PARTITION BY ${input.partitionBy}` : ""}${mergeTree ? ` ORDER BY ${input.orderBy || "tuple()"}` : ""}${input.ttl ? ` TTL ${input.ttl}` : ""}${input.settings ? ` SETTINGS ${input.settings}` : ""}`;
  validateSql(sql);
  return sql;
}
export const createTable = defineAction({
  id: "create-table",
  input: createTableInput,
  run: (input, ctx: Context) => {
    confirm(input, ctx);
    return executeCommand(createTableSql(input), input.database, ctx);
  },
});
export const createViewInput = z.object({
  ...base,
  kind: z.enum(["view", "materialized-view"]),
  select: z.string().min(1).max(100_000),
  targetDatabase: z.string().default(""),
  targetTable: z.string().default(""),
});
export const createView = defineAction({
  id: "create-view",
  input: createViewInput,
  run: (input, ctx: Context) => {
    confirm(input, ctx);
    if (!["SELECT", "WITH"].includes(validateSql(input.select)))
      throw new Error("The view definition must be a SELECT query.");
    if (input.kind === "materialized-view" && !input.targetTable)
      throw new Error("A materialized view requires an existing target table.");
    const target =
      input.kind === "materialized-view"
        ? ` TO ${qualified(input.targetDatabase || input.database, input.targetTable)}`
        : "";
    return executeCommand(
      `CREATE ${input.kind === "view" ? "VIEW" : "MATERIALIZED VIEW"} ${qualified(input.database, input.name)}${clusterClause(input.cluster)}${target} AS ${input.select.trim().replace(/;\s*$/, "")}`,
      input.database,
      ctx,
    );
  },
});
const operations = [
  "rename",
  "drop-column",
  "add-column",
  "update",
  "delete",
  "add-index",
  "drop-index",
  "add-projection",
  "drop-projection",
  "modify-ttl",
  "attach-partition",
  "detach-partition",
  "drop-partition",
  "freeze-partition",
  "unfreeze-partition",
  "move-partition-disk",
  "sync-replica",
  "restart-replica",
  "kill-mutation",
] as const;
export const alterTableInput = z.object({
  ...base,
  operation: z.enum(operations),
  definition: z.string().default(""),
  partitionId: z.string().default(""),
  destination: z.string().default(""),
});
function literal(value: string) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}
export function alterTableSql(input: z.output<typeof alterTableInput>) {
  const target = qualified(input.database, input.name);
  const scope = clusterClause(input.cluster);
  const definition = input.definition;
  if (input.operation === "kill-mutation") {
    if (!definition) throw new Error("Specify the mutation ID.");
    return `KILL MUTATION${scope} WHERE database = ${literal(input.database)} AND table = ${literal(input.name)} AND mutation_id = ${literal(definition)}`;
  }
  if (input.operation === "sync-replica")
    return `SYSTEM SYNC REPLICA${scope} ${target}`;
  if (input.operation === "restart-replica")
    return `SYSTEM RESTART REPLICA${scope} ${target}`;
  if (input.operation === "rename") {
    if (!definition) throw new Error("Specify the new table name.");
    return `RENAME TABLE ${target} TO ${qualified(input.database, definition)}${scope}`;
  }
  const definitions: Record<string, string> = {
    "drop-column": "DROP COLUMN",
    "add-column": "ADD COLUMN",
    update: "UPDATE",
    delete: "DELETE WHERE",
    "add-index": "ADD INDEX",
    "drop-index": "DROP INDEX",
    "add-projection": "ADD PROJECTION",
    "drop-projection": "DROP PROJECTION",
    "modify-ttl": "MODIFY TTL",
  };
  const clause = definitions[input.operation];
  if (clause) {
    if (!definition) throw new Error("Specify an operation definition.");
    const value = input.operation.startsWith("drop-")
      ? quoteIdentifier(definition)
      : definition;
    return `ALTER TABLE ${target}${scope} ${clause} ${value}`;
  }
  return partitionSql(input, target, scope);
}
function partitionSql(
  input: z.output<typeof alterTableInput>,
  target: string,
  scope: string,
) {
  if (!input.partitionId)
    throw new Error("Specify a partition ID from the Parts inspection.");
  const partition = `PARTITION ID ${literal(input.partitionId)}`;
  const partitionCommands: Record<string, string> = {
    "attach-partition": "ATTACH",
    "detach-partition": "DETACH",
    "drop-partition": "DROP",
    "freeze-partition": "FREEZE",
    "unfreeze-partition": "UNFREEZE",
  };
  if (input.operation === "move-partition-disk") {
    if (!input.destination) throw new Error("Specify a disk destination.");
    return `ALTER TABLE ${target}${scope} MOVE ${partition} TO DISK ${literal(input.destination)}`;
  }
  const command = partitionCommands[input.operation];
  if (!command) throw new Error("Unsupported operation.");
  const name = input.operation.endsWith("freeze-partition")
    ? ` WITH NAME ${literal(input.destination || "dsui")}`
    : "";
  return `ALTER TABLE ${target}${scope} ${command} ${partition}${name}`;
}

export const alterTable = defineAction({
  id: "alter-table",
  input: alterTableInput,
  run: (input, ctx: Context) => {
    confirm(input, ctx);
    return executeCommand(alterTableSql(input), input.database, ctx);
  },
});
function commonFields() {
  return [
    TextInput({ name: "database", label: "Database" }),
    TextInput({ name: "name", label: "Object name" }),
    TextInput({
      name: "cluster",
      label: "Cluster (optional; runs across its nodes)",
    }),
    TextInput({
      name: "confirmTarget",
      label: "Type database.name to confirm",
    }),
  ];
}
function createTableFields() {
  return [
    ...commonFields(),
    TextInput({
      name: "columns",
      label: "Column definitions (SQL)",
      placeholder: "id UInt64, created_at DateTime",
    }),
    Select({
      name: "engine",
      label: "Engine",
      value: "MergeTree",
      options: createTableInput.shape.engine.options.map((value) => ({
        value,
        label: value,
      })),
    }),
    TextInput({
      name: "engineArguments",
      label:
        "Engine arguments (SQL; required for Distributed and collapsing engines)",
    }),
    TextInput({
      name: "orderBy",
      label: "Sorting key (SQL; empty uses tuple())",
    }),
    TextInput({
      name: "partitionBy",
      label: "Partition expression (optional SQL)",
    }),
    TextInput({
      name: "ttl",
      label: "TTL expression (optional SQL)",
    }),
    TextInput({
      name: "settings",
      label: "Engine settings (optional SQL)",
    }),
  ];
}
function createViewFields() {
  return [
    ...commonFields(),
    Select({
      name: "kind",
      label: "View kind",
      value: "view",
      options: [
        { label: "View", value: "view" },
        { label: "Materialized view", value: "materialized-view" },
      ],
    }),
    TextInput({ name: "select", label: "SELECT query" }),
    TextInput({
      name: "targetDatabase",
      label: "Materialized view target database (optional)",
    }),
    TextInput({
      name: "targetTable",
      label: "Materialized view target table (required for materialized views)",
    }),
  ];
}
function alterTableFields() {
  return [
    ...commonFields(),
    Select({
      name: "operation",
      label: "Operation",
      options: operations.map((value) => ({
        value,
        label: value.replaceAll("-", " "),
      })),
    }),
    TextInput({
      name: "definition",
      label:
        "Definition (SQL), new name, column/index/projection name, or mutation ID",
    }),
    TextInput({
      name: "partitionId",
      label: "Partition ID (partition operations only)",
    }),
    TextInput({
      name: "destination",
      label: "Destination disk or snapshot name (optional)",
    }),
  ];
}
export const managementPage = definePage({
  path: "/manage",
  render: () => [
    PageHeader({
      title: "Manage objects",
      description:
        "Actions run with your configured role. Cluster actions and mutations may finish asynchronously. Review the exact target; operations can be destructive.",
    }),
    Tabs({
      items: [
        {
          label: "Create table",
          content: Form({
            schema: createTableInput,
            onSubmit: createTable,
            submitLabel: "Create confirmed table",
            fields: createTableFields(),
          }),
        },
        {
          label: "Create view",
          content: Form({
            schema: createViewInput,
            onSubmit: createView,
            submitLabel: "Create confirmed view",
            fields: createViewFields(),
          }),
        },
        {
          label: "Alter and maintain",
          content: Form({
            schema: alterTableInput,
            onSubmit: alterTable,
            submitLabel: "Execute confirmed operation",
            fields: alterTableFields(),
          }),
        },
      ],
    }),
  ],
});
export const managementActions = [createTable, createView, alterTable];
