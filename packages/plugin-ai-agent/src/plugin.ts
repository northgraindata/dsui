import {
  defineComponent,
  definePlugin,
  defineSlot,
  type PluginContext,
  PluginRequestError,
  type PluginServiceSummary,
  z,
} from "@northgraindata/dsui-plugin-sdk";
import { type AgentRuntime, AiSdkRuntime } from "./agent";
import { validateAttachments } from "./attachment-validation";
import {
  attachmentUploadSchema,
  MAX_ATTACHMENTS,
  MAX_CONVERSATION_ATTACHMENT_BYTES,
} from "./attachments";
import { history, owner, read, readAttachmentData, save } from "./database";
import { mentionServices, serviceMentions } from "./mentions";
import {
  type Config,
  type Conversation,
  configSchema,
  toolDescriptions,
  toolNames,
} from "./model";
import { configuredModels, modelSecrets, selectModel } from "./model-config";
import { replyInputSchema, resolveReply } from "./replies";
import { boundOutput, executeTool, withAbortSignal } from "./tools";

const launcher = defineComponent({
  id: "ai-agent/launcher",
  path: "./browser",
});

function generatedTitle(raw: string): string {
  const firstLine = raw.split(/\r?\n/, 1)[0] ?? "";
  return firstLine
    .replace(/^\s*(?:title|tytuł)\s*:\s*/i, "")
    .replace(/^\s*[#"'`]+|["'`]+\s*$/g, "")
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70)
    .trim();
}

export function createAiAgentPlugin(
  runtime: AgentRuntime = new AiSdkRuntime(),
) {
  const active = new Map<
    string,
    { controller: AbortController; done: Promise<void> }
  >();
  const load = (context: PluginContext<Config>, id: string) => {
    const conversation = read(context, id);
    if (conversation.status === "running" && !active.has(id)) {
      conversation.status = "error";
      conversation.error =
        "The previous response was interrupted. Send a new message to continue.";
      save(context, conversation);
    }
    return conversation;
  };
  return definePlugin({
    metadata: {
      id: "ai-agent",
      name: "DSUI Agent",
      version: "0.1.0",
      apiVersion: 1,
    },
    configSchema,
    setup(registry) {
      registry.slot(
        defineSlot({
          id: "launcher",
          slot: "app.shell.actions",
          render: () => launcher(),
        }),
      );
      registry.procedure({
        id: "state",
        permission: "inspect",
        input: z.object({ conversationId: z.string().optional() }),
        handler: async (context, input) => {
          const conversation = input.conversationId
            ? load(context, input.conversationId)
            : undefined;
          if (conversation)
            for (const id of new Set(conversation.accessedServiceIds))
              await context.access.require(id, "inspect");
          const services: PluginServiceSummary[] = [];
          let cursor: string | undefined;
          do {
            const page = await context.services.list({ cursor, limit: 100 });
            services.push(...page.items);
            cursor = page.nextCursor;
          } while (cursor);
          const models = configuredModels(context.config);
          const currentModel =
            models.find((model) => model.key === conversation?.modelKey) ??
            models[0] ??
            context.config.model;
          return {
            configured: models.length > 0,
            model: {
              provider: currentModel.provider,
              id: currentModel.id,
            },
            models: models.map(({ key, label, provider, id }) => ({
              key,
              label,
              provider,
              id,
            })),
            services,
            conversations: await history(context),
            conversation,
            tools: toolNames.map((name) => ({
              name,
              description: toolDescriptions[name],
            })),
          };
        },
      });
      registry.procedure({
        id: "rename",
        permission: "inspect",
        input: z.object({
          conversationId: z.string().min(1),
          title: z
            .string()
            .trim()
            .min(1)
            .max(70)
            .regex(/^[^\r\n]+$/),
        }),
        handler: async (context, input) => {
          const conversation = load(context, input.conversationId);
          for (const id of new Set(conversation.accessedServiceIds))
            await context.access.require(id, "inspect");
          // A running turn holds its own snapshot and would overwrite the rename.
          if (active.has(conversation.id))
            throw new PluginRequestError(
              "Wait for the response to finish before renaming this chat",
              409,
            );
          conversation.title = input.title;
          save(context, conversation);
          return { conversationId: conversation.id, title: conversation.title };
        },
      });
      registry.procedure({
        id: "attachment",
        permission: "inspect",
        input: z.object({
          conversationId: z.string(),
          attachmentId: z.string().uuid(),
        }),
        handler: async (context, input) => {
          const conversation = load(context, input.conversationId);
          for (const id of new Set(conversation.accessedServiceIds))
            await context.access.require(id, "inspect");
          if (
            !conversation.messages.some((message) =>
              message.attachments.some(
                (attachment) => attachment.id === input.attachmentId,
              ),
            )
          )
            throw new PluginRequestError("Attachment not found", 404);
          return {
            data: readAttachmentData(
              context,
              conversation.id,
              input.attachmentId,
            ),
          };
        },
      });
      registry.procedure({
        id: "send",
        permission: "inspect",
        input: z
          .object({
            conversationId: z.string().optional(),
            modelKey: z.string().min(1).max(64).optional(),
            message: z.string().trim().max(16_000),
            replyTo: replyInputSchema.optional(),
            attachments: z
              .array(attachmentUploadSchema)
              .max(MAX_ATTACHMENTS)
              .default([]),
            serviceIds: z.array(z.string().min(1)).max(100).default([]),
          })
          .refine(
            (input) => Boolean(input.message || input.attachments.length),
            "Add a message or attachment",
          ),
        handler: async (context, input) => {
          const attachments = input.attachments ?? [];
          const conversation: Conversation = input.conversationId
            ? load(context, input.conversationId)
            : {
                id: crypto.randomUUID(),
                ownerId: owner(context),
                title: "New chat",
                serviceIds: input.serviceIds ?? [],
                accessedServiceIds: [],
                status: "idle",
                messages: [],
                tools: [],
              };
          const model = selectModel(
            context.config,
            input.modelKey ?? conversation.modelKey,
          );
          const secrets = modelSecrets(context.config);
          if (active.has(conversation.id))
            throw new PluginRequestError("A response is already running", 409);
          const replyTo = resolveReply(conversation.messages, input.replyTo);
          validateAttachments(attachments);
          const previousBytes = conversation.messages.reduce(
            (sum, message) =>
              sum +
              message.attachments.reduce(
                (size, attachment) => size + attachment.size,
                0,
              ),
            0,
          );
          if (
            previousBytes +
              attachments.reduce(
                (sum, attachment) => sum + attachment.size,
                0,
              ) >
            MAX_CONVERSATION_ATTACHMENT_BYTES
          )
            throw new PluginRequestError(
              "This chat has reached its 50 MB attachment limit. Start a new chat to attach more files.",
              422,
            );
          const services: PluginServiceSummary[] = [];
          if (input.message.includes("@")) {
            let cursor: string | undefined;
            do {
              const page = await context.services.list({ cursor, limit: 100 });
              services.push(...page.items);
              cursor = page.nextCursor;
            } while (cursor);
          }
          const mentions = serviceMentions(
            input.message,
            mentionServices(services),
          );
          const unknownMention = mentions.find((mention) => !mention.service);
          if (unknownMention)
            throw new PluginRequestError(
              `Service mention not found or accessible: @${unknownMention.handle}`,
              422,
            );
          const mentionedIds = [
            ...new Set(
              mentions.flatMap((mention) =>
                mention.service ? [mention.service.id] : [],
              ),
            ),
          ];
          // Chat turns always have workspace scope. Mentions guide the agent's
          // first look, but never prevent it from inspecting other services.
          for (const id of new Set([
            ...conversation.accessedServiceIds,
            ...mentionedIds,
          ]))
            await context.access.require(id, "inspect");
          if (active.has(conversation.id))
            throw new PluginRequestError("A response is already running", 409);
          conversation.accessedServiceIds = [
            ...new Set([...conversation.accessedServiceIds, ...mentionedIds]),
          ];
          conversation.serviceIds = [];
          conversation.modelKey = model.key;
          const uploads = attachments.map((attachment) => ({
            ...attachment,
            id: crypto.randomUUID(),
          }));
          const now = new Date().toISOString();
          conversation.messages.push({
            id: crypto.randomUUID(),
            role: "user",
            text: input.message,
            ...(replyTo ? { replyTo } : {}),
            attachments: uploads.map(({ id, name, mediaType, size }) => ({
              id,
              name,
              mediaType,
              size,
            })),
            createdAt: now,
          });
          const assistant = {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            model: { provider: model.provider, id: model.id },
            text: "",
            attachments: [],
            createdAt: now,
          };
          conversation.messages.push(assistant);
          conversation.status = "running";
          conversation.error = undefined;
          save(context, conversation, uploads);
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(new Error("Agent response timed out")),
            context.config.timeoutSeconds * 1000,
          );
          const titleSignal = AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8_000),
          ]);
          const generateTitle = runtime.title?.bind(runtime);
          const titleTask =
            !input.conversationId && generateTitle
              ? withAbortSignal(
                  titleSignal,
                  Promise.resolve().then(() =>
                    generateTitle({
                      model,
                      message: input.message,
                      attachmentNames: uploads.map(({ name }) => name),
                      signal: titleSignal,
                    }),
                  ),
                )
                  .then((candidate) => {
                    const title = generatedTitle(candidate);
                    if (!title || titleSignal.aborted) return;
                    conversation.title = title;
                    save(context, conversation);
                  })
                  .catch(() => {
                    // A title failure does not affect the user's answer.
                  })
              : Promise.resolve();
          let calls = 0;
          const pendingTools = new Set<Promise<unknown>>();
          const done = runtime
            .turn({
              context: { ...context, config: { ...context.config, model } },
              conversation,
              focusServiceIds: mentionedIds,
              signal: controller.signal,
              execute: (name, raw) => {
                const pending = (async () => {
                  controller.signal.throwIfAborted();
                  if (++calls > context.config.maxToolCalls) {
                    controller.abort(
                      new Error("Agent tool call limit reached"),
                    );
                    throw new Error("Tool call limit reached");
                  }
                  const tool: Conversation["tools"][number] = {
                    id: crypto.randomUUID(),
                    messageId: assistant.id,
                    name,
                    input: boundOutput(raw, 24_000, secrets),
                    status: "running",
                  };
                  conversation.tools.push(tool);
                  save(context, conversation);
                  try {
                    const output = await withAbortSignal(
                      controller.signal,
                      executeTool(context, [], name, raw),
                    );
                    if (
                      raw &&
                      typeof raw === "object" &&
                      "serviceId" in raw &&
                      typeof raw.serviceId === "string"
                    )
                      conversation.accessedServiceIds.push(raw.serviceId);
                    if (
                      output &&
                      typeof output === "object" &&
                      "items" in output &&
                      Array.isArray(output.items)
                    ) {
                      for (const item of output.items) {
                        if (item && typeof item === "object") {
                          if (
                            name === "read_resources_batch" &&
                            item.status !== "completed"
                          )
                            continue;
                          const id =
                            name === "list_services" ? item.id : item.serviceId;
                          if (typeof id === "string")
                            conversation.accessedServiceIds.push(id);
                        }
                      }
                    }
                    conversation.accessedServiceIds = [
                      ...new Set(conversation.accessedServiceIds),
                    ];
                    tool.output = boundOutput(
                      output,
                      24_000,
                      secrets,
                      context.config.sensitiveColumns,
                    );
                    controller.signal.throwIfAborted();
                    tool.status = "completed";
                    return tool.output;
                  } catch (cause) {
                    const error =
                      cause instanceof PluginRequestError
                        ? cause.message
                        : "Resource unavailable or access denied";
                    tool.status = "error";
                    tool.output = {
                      error,
                    };
                    throw new Error(error);
                  } finally {
                    save(context, conversation);
                  }
                })();
                pendingTools.add(pending);
                void pending.then(
                  () => pendingTools.delete(pending),
                  () => pendingTools.delete(pending),
                );
                return pending;
              },
              onText: (text) => {
                assistant.text = text;
                if (assistant.text.length > 250_000)
                  controller.abort(
                    new Error("Agent response exceeds size limit"),
                  );
                save(context, conversation);
              },
            })
            .then(() => {
              conversation.status = "idle";
            })
            .catch(() => {
              conversation.status = "error";
              conversation.error = controller.signal.aborted
                ? "Response stopped or timed out."
                : "The agent could not complete this response. Check the model, provider and API key.";
              // Terminate any remaining provider activity before releasing the turn lock.
              if (!controller.signal.aborted) controller.abort();
            })
            .then(async () => {
              // Drain already-authorized callbacks before another turn can mutate this conversation.
              await Promise.allSettled([...pendingTools, titleTask]);
              clearTimeout(timeout);
              active.delete(conversation.id);
              save(context, conversation);
            });
          active.set(conversation.id, { controller, done });
          return { conversationId: conversation.id };
        },
      });
      registry.procedure({
        id: "cancel",
        permission: "inspect",
        input: z.object({ conversationId: z.string() }),
        handler: (context, input) => {
          read(context, input.conversationId);
          active
            .get(input.conversationId)
            ?.controller.abort(new Error("Stopped by user"));
          return { stopped: true };
        },
      });
    },
    stop: async () => {
      for (const run of active.values()) run.controller.abort();
      await Promise.allSettled([...active.values()].map((run) => run.done));
    },
  });
}
export default createAiAgentPlugin();
