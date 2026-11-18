import { z } from "@northgraindata/dsui-plugin-sdk";
import { attachmentSchema, MAX_ATTACHMENTS } from "../attachments/attachments";
import { messageReplySchema } from "../chat/replies";
import { modelConnectionSchema, namedModelSchema } from "./model-config";

export const configSchema = z.object({
  model: modelConnectionSchema.default({}),
  models: z
    .array(namedModelSchema)
    .max(20)
    .default([])
    .refine(
      (models) =>
        new Set(models.map((model) => model.key)).size === models.length,
      "Model keys must be unique",
    ),
  maxToolCalls: z.number().int().min(1).max(100).default(20),
  timeoutSeconds: z.number().int().min(10).max(600).default(120),
  allowActionExecution: z.boolean().default(true),
  requestsPerMinute: z.number().int().min(1).max(60).default(5),
  sensitiveColumns: z
    .array(z.string().min(1))
    .default([
      "email",
      "phone",
      "phone_number",
      "address",
      "ssn",
      "date_of_birth",
      "credit_card",
      "card_number",
      "first_name",
      "last_name",
    ]),
});
export type Config = z.infer<typeof configSchema>;
export const toolNames = [
  "list_skills",
  "read_skill",
  "list_services",
  "list_plugins",
  "search_workspace_resources",
  "get_service_health",
  "list_events",
  "list_resources",
  "query_resource",
  "read_resources_batch",
  "list_actions",
  "execute_action",
  "list_plugin_resources",
  "query_plugin_resource",
  "list_plugin_actions",
  "execute_plugin_action",
] as const;
export function availableToolNames(allowActionExecution: boolean) {
  return toolNames.filter(
    (name) =>
      allowActionExecution ||
      (name !== "execute_action" && name !== "execute_plugin_action"),
  );
}
export const toolDescriptions = {
  list_skills: "List plugin-provided task guides and when to use them.",
  read_skill: "Read one plugin-provided Markdown task guide by its exact ID.",
  list_services:
    "List services available to the current user in this workspace.",
  list_plugins: "List plugins visible to the current user in this workspace.",
  search_workspace_resources:
    "Search resource IDs and descriptions across a bounded page of visible services. Use nextOffset within the page, then nextCursor for the next service page. Discover the selected resource to get its input schema.",
  get_service_health: "Check a service's reachability and health checks.",
  list_events: "Read recorded DSUI events. This does not start monitoring.",
  list_resources:
    "List a service's declared resources and input schemas. Follow nextCursor to discover all resources.",
  query_resource: "Query one declared service resource with its input.",
  read_resources_batch:
    "Query up to five independent service resources concurrently. Use for comparisons, not dependent reads.",
  list_actions:
    "List a service's declared actions and input schemas. Follow nextCursor for more.",
  execute_action:
    "Execute a declared service action with its input. Requires execute permission.",
  list_plugin_resources:
    "List a plugin's declared resources and input schemas.",
  query_plugin_resource:
    "Query a declared plugin resource with its input. Requires inspect permission.",
  list_plugin_actions:
    "List a plugin's declared actions, input schemas, and permissions.",
  execute_plugin_action:
    "Execute a declared plugin action with its input. The host checks its declared permission.",
};
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
  replyTo: messageReplySchema.optional(),
  model: z.object({ provider: z.string(), id: z.string() }).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).default([]),
  createdAt: z.string(),
});
export const toolRunSchema = z.object({
  id: z.string(),
  messageId: z.string().optional(),
  name: z.string(),
  input: z.unknown(),
  output: z.unknown().optional(),
  status: z.enum(["running", "completed", "error"]),
});
export const conversationSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  modelKey: z.string().optional(),
  serviceIds: z.array(z.string()),
  accessedServiceIds: z.array(z.string()).default([]),
  accessedPluginIds: z.array(z.string()).default([]),
  status: z.enum(["idle", "running", "error"]),
  error: z.string().optional(),
  messages: z.array(messageSchema),
  tools: z.array(toolRunSchema),
});
export type Conversation = z.infer<typeof conversationSchema>;
