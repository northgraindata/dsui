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
import { history, owner, read, save } from "./database";
import { mentionServices, serviceMentions } from "./mentions";
import {
  type Config,
  type Conversation,
  configSchema,
  toolDescriptions,
  toolNames,
} from "./model";
import { boundOutput, executeTool, withAbortSignal } from "./tools";

const launcher = defineComponent({
  id: "ai-agent/launcher",
  path: "./browser",
});
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
            for (const id of new Set([
              ...conversation.serviceIds,
              ...conversation.accessedServiceIds,
            ]))
              await context.access.require(id, "inspect");
          const services: PluginServiceSummary[] = [];
          let cursor: string | undefined;
          do {
            const page = await context.services.list({ cursor, limit: 100 });
            services.push(...page.items);
            cursor = page.nextCursor;
          } while (cursor);
          return {
            configured: Boolean(context.config.model.apiKey),
            model: {
              provider: context.config.model.provider,
              id: context.config.model.id,
            },
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
        id: "send",
        permission: "inspect",
        input: z.object({
          conversationId: z.string().optional(),
          message: z.string().trim().min(1).max(16_000),
          serviceIds: z.array(z.string().min(1)).max(100).default([]),
        }),
        handler: async (context, input) => {
          if (!context.config.model.apiKey)
            throw new PluginRequestError(
              "Configure plugins.ai-agent.config.model.apiKey in dsui.yaml",
              409,
            );
          const conversation: Conversation = input.conversationId
            ? load(context, input.conversationId)
            : {
                id: crypto.randomUUID(),
                ownerId: owner(context),
                title: input.message.slice(0, 70),
                serviceIds: input.serviceIds ?? [],
                accessedServiceIds: [],
                status: "idle",
                messages: [],
                tools: [],
              };
          if (active.has(conversation.id))
            throw new PluginRequestError("A response is already running", 409);
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
          const selectedServiceIds = [...new Set(input.serviceIds)];
          const turnServiceIds = mentionedIds.length
            ? mentionedIds
            : selectedServiceIds;
          for (const id of new Set([
            ...conversation.serviceIds,
            ...conversation.accessedServiceIds,
            ...selectedServiceIds,
            ...turnServiceIds,
          ]))
            await context.access.require(id, "inspect");
          if (active.has(conversation.id))
            throw new PluginRequestError("A response is already running", 409);
          conversation.accessedServiceIds = [
            ...new Set([
              ...conversation.accessedServiceIds,
              ...conversation.serviceIds,
              ...mentionedIds,
            ]),
          ];
          conversation.serviceIds = selectedServiceIds;
          const now = new Date().toISOString();
          conversation.messages.push({
            id: crypto.randomUUID(),
            role: "user",
            text: input.message,
            createdAt: now,
          });
          const assistant = {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text: "",
            createdAt: now,
          };
          conversation.messages.push(assistant);
          conversation.status = "running";
          conversation.error = undefined;
          save(context, conversation);
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(new Error("Agent response timed out")),
            context.config.timeoutSeconds * 1000,
          );
          let calls = 0;
          const pendingTools = new Set<Promise<unknown>>();
          const done = runtime
            .turn({
              context,
              conversation,
              serviceIds: turnServiceIds,
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
                    input: boundOutput(raw, 24_000, [
                      context.config.model.apiKey,
                    ]),
                    status: "running",
                  };
                  conversation.tools.push(tool);
                  save(context, conversation);
                  try {
                    const output = await withAbortSignal(
                      controller.signal,
                      executeTool(context, turnServiceIds, name, raw),
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
                    tool.output = boundOutput(output, 24_000, [
                      context.config.model.apiKey,
                    ]);
                    controller.signal.throwIfAborted();
                    tool.status = "completed";
                    return tool.output;
                  } catch {
                    tool.status = "error";
                    tool.output = {
                      error: "Resource unavailable or access denied",
                    };
                    throw new Error("Resource unavailable or access denied");
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
              await Promise.allSettled([...pendingTools]);
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
