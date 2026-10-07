import { z } from "@northgraindata/dsui-plugin-sdk";
import { attachmentSchema, MAX_ATTACHMENTS } from "./attachments";

export const configSchema = z.object({
  model: z
    .object({
      provider: z.enum(["openai", "anthropic", "gateway"]).default("openai"),
      id: z.string().min(1).default("gpt-4.1-mini"),
      apiKey: z.string().default(""),
    })
    .default({}),
  maxToolCalls: z.number().int().min(1).max(100).default(20),
  timeoutSeconds: z.number().int().min(10).max(600).default(120),
  allowReadOnlySql: z.boolean().default(false),
  allowTablePreview: z.boolean().default(true),
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
  "list_services",
  "get_service_health",
  "list_events",
  "discover_resources",
  "read_resource",
  "list_actions",
] as const;
export const toolDescriptions = {
  list_services: "List services available in the selected workspace context.",
  get_service_health: "Check a service's reachability and health checks.",
  list_events: "Read recorded DSUI events. This does not start monitoring.",
  discover_resources:
    "Discover a service's readable resources, adapter-provided descriptions, input schemas, policies and availability. Follow nextCursor to discover all resources before claiming an operation is unsupported.",
  read_resource: "Read one declared adapter resource with validated arguments.",
  list_actions:
    "Discover a service's declared actions, descriptions and input schemas. Follow nextCursor for more. Discovery only: action execution is not enabled. Do not claim to have performed any action.",
};
export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
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
  serviceIds: z.array(z.string()),
  accessedServiceIds: z.array(z.string()).default([]),
  status: z.enum(["idle", "running", "error"]),
  error: z.string().optional(),
  messages: z.array(messageSchema),
  tools: z.array(toolRunSchema),
});
export type Conversation = z.infer<typeof conversationSchema>;
