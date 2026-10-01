import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import { serializeNodes } from "@northgraindata/dsui-adapter-sdk";
import type { z } from "zod";

export type { PageDocument, PageNode } from "@northgraindata/dsui-adapter-sdk";
export {
  Badge,
  Button,
  Card,
  defineComponent,
  Grid,
  PageHeader,
  Section,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";

export const PLUGIN_API_VERSION = 1 as const;

export type PluginMetadata = {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly apiVersion: typeof PLUGIN_API_VERSION;
  readonly security?: boolean;
};

export type PluginPage = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
};

export type PluginPageRenderInput<TConfig = unknown> = {
  readonly context: PluginContext<TConfig>;
  readonly params: Record<string, string>;
};

export type PluginPageDefinition<TConfig = unknown> = PluginPage & {
  readonly render: (
    input: PluginPageRenderInput<TConfig>,
  ) => PageNode | readonly PageNode[] | Promise<PageNode | readonly PageNode[]>;
};

export type RuntimePluginPage = PluginPage & {
  readonly render: (
    params: Record<string, string>,
  ) => Promise<readonly PageNode[]>;
};

export type PluginNavigationItem = {
  readonly id: string;
  readonly area: "primary" | "secondary";
  readonly label: string;
  readonly pageId: string;
  readonly order?: number;
};

export type PluginSlotName =
  | "dashboard.service-card.trailing"
  | "service.workspace.after-header";

export type PluginUiSlot = {
  readonly id: string;
  readonly slot: PluginSlotName;
  readonly order?: number;
};

export type PluginSlotDefinition<TConfig = unknown> = PluginUiSlot & {
  readonly render: (input: {
    readonly context: PluginContext<TConfig>;
    readonly service: PluginServiceSummary;
  }) =>
    | PageNode
    | readonly PageNode[]
    | Promise<PageNode | readonly PageNode[]>;
};

export type RuntimePluginSlot = PluginUiSlot & {
  readonly render: (input: {
    service: PluginServiceSummary;
  }) => Promise<readonly PageNode[]>;
};

export type PluginServiceSummary = {
  readonly id: string;
  readonly name: string;
  readonly adapter: string;
  readonly managedBy: "configuration" | "ui";
};

export interface PluginServiceCatalog {
  list(input?: { readonly cursor?: string; readonly limit?: number }): Promise<{
    readonly items: PluginServiceSummary[];
    readonly nextCursor?: string;
  }>;
  get(id: string): Promise<PluginServiceSummary | null>;
}

export type PluginReadinessStatus = "ready" | "disabled" | "unavailable";

export type PluginCatalog = {
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    status: PluginReadinessStatus;
    detail?: string;
  }>;
  pages: Array<PluginPage & { pluginId: string }>;
  navigation: Array<PluginNavigationItem & { pluginId: string }>;
  slots: Array<PluginUiSlot & { pluginId: string }>;
};

export type PluginSlotResult = {
  serviceId: string;
  pluginId: string;
  slotId: string;
  nodes: readonly PageNode[];
  error?: string;
};

export type PluginPrincipal = {
  id: string;
  role: "owner" | "admin" | "operator" | "viewer";
};

export type PluginPermission = "inspect" | "execute" | "manage";
export type PluginResource = { type: "service" | "plugin"; id: string };

export interface PluginAuthenticationProvider {
  authenticate(
    request: Request,
  ): Promise<PluginPrincipal | null> | PluginPrincipal | null;
}

export interface PluginAuthorizationProvider {
  authorize(input: {
    principal: PluginPrincipal;
    permission: PluginPermission;
    resource?: PluginResource;
  }): Promise<boolean> | boolean;
}

export type PluginProcedure<
  TContext = unknown,
  TInput = unknown,
  TOutput = unknown,
> = {
  readonly id: string;
  readonly input: z.ZodType<TInput>;
  readonly output?: z.ZodType<TOutput>;
  readonly permission: "inspect" | "execute" | "manage";
  readonly handler: (
    context: TContext,
    input: TInput,
  ) => Promise<TOutput> | TOutput;
};

export type RuntimePluginProcedure = {
  readonly id: string;
  readonly input: z.ZodTypeAny;
  readonly output?: z.ZodTypeAny;
  readonly permission: "inspect" | "execute" | "manage";
  readonly invoke: (input: unknown) => Promise<unknown> | unknown;
};

export interface RuntimePluginRegistry {
  page(page: RuntimePluginPage): void;
  navigation(item: PluginNavigationItem): void;
  slot(slot: RuntimePluginSlot): void;
  procedure(procedure: RuntimePluginProcedure): void;
  authentication(provider: PluginAuthenticationProvider): void;
  authorization(provider: PluginAuthorizationProvider): void;
}

export interface PluginRegistry<TConfig = unknown> {
  page(page: PluginPageDefinition<TConfig>): void;
  navigation(item: PluginNavigationItem): void;
  slot(slot: PluginSlotDefinition<TConfig>): void;
  procedure<TInput, TOutput = unknown>(
    procedure: PluginProcedure<PluginContext<TConfig>, TInput, TOutput>,
  ): void;
  authentication(provider: PluginAuthenticationProvider): void;
  authorization(provider: PluginAuthorizationProvider): void;
}

export interface PluginContext<TConfig = unknown> {
  readonly pluginId: string;
  readonly config: Readonly<TConfig>;
  readonly services: PluginServiceCatalog;
  readonly logger: {
    info(message: string, metadata?: Record<string, unknown>): void;
    warn(message: string, metadata?: Record<string, unknown>): void;
    error(message: string, metadata?: Record<string, unknown>): void;
  };
}

export interface PluginDefinition<TConfig = unknown> {
  readonly kind: "dsui-plugin";
  readonly metadata: PluginMetadata;
  readonly configSchema: z.ZodType<TConfig>;
  readonly requires?: readonly string[];
  readonly setup: (
    registry: PluginRegistry<TConfig>,
    config: Readonly<TConfig>,
  ) => void;
  readonly start?: (context: PluginContext<TConfig>) => Promise<void> | void;
  readonly stop?: () => Promise<void> | void;
}

export interface PreparedPlugin {
  readonly setup: (registry: RuntimePluginRegistry) => void;
  readonly start: () => Promise<void> | void;
}

export interface RuntimePluginDefinition {
  readonly kind: "dsui-plugin";
  readonly metadata: PluginMetadata;
  readonly configSchema: z.ZodTypeAny;
  readonly requires?: readonly string[];
  readonly prepare: (
    config: unknown,
    host: Pick<PluginContext<unknown>, "services" | "logger">,
  ) => PreparedPlugin;
  readonly stop?: () => Promise<void> | void;
}

export function definePlugin<TConfig>(
  definition: Omit<PluginDefinition<TConfig>, "kind">,
): PluginDefinition<TConfig> & RuntimePluginDefinition {
  const plugin: PluginDefinition<TConfig> & RuntimePluginDefinition = {
    kind: "dsui-plugin",
    ...definition,
    prepare(rawConfig, host) {
      const config = definition.configSchema.parse(rawConfig);
      const context: PluginContext<TConfig> = {
        pluginId: definition.metadata.id,
        config,
        services: host.services,
        logger: host.logger,
      };
      return {
        setup(runtimeRegistry) {
          const registry: PluginRegistry<TConfig> = {
            page: (page) =>
              runtimeRegistry.page({
                id: page.id,
                title: page.title,
                description: page.description,
                render: async (params) => {
                  return serializeNodes(await page.render({ context, params }));
                },
              }),
            navigation: (item) => runtimeRegistry.navigation(item),
            slot: (slot) =>
              runtimeRegistry.slot({
                id: slot.id,
                slot: slot.slot,
                order: slot.order,
                render: async ({ service }) =>
                  serializeNodes(await slot.render({ context, service })),
              }),
            procedure: (procedure) =>
              runtimeRegistry.procedure({
                id: procedure.id,
                input: procedure.input,
                output: procedure.output,
                permission: procedure.permission,
                invoke: async (input) => {
                  const parsedInput = procedure.input.parse(input);
                  const result = await procedure.handler(context, parsedInput);
                  return procedure.output
                    ? procedure.output.parse(result)
                    : result;
                },
              }),
            authentication: (provider) => {
              if (!definition.metadata.security)
                throw new Error(
                  "Authentication plugins must declare security: true",
                );
              runtimeRegistry.authentication(provider);
            },
            authorization: (provider) => {
              if (!definition.metadata.security)
                throw new Error(
                  "Authorization plugins must declare security: true",
                );
              runtimeRegistry.authorization(provider);
            },
          };
          definition.setup(registry, config);
        },
        start: () => definition.start?.(context),
      };
    },
  };
  return plugin;
}
