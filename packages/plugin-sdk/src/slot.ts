/**
 * Plugin UI slots, mirroring the adapter SDK's component composition.
 *
 * A slot is a named place in the host UI where a plugin contributes nodes:
 * a dashboard card's trailing region, a service header's footer. Declaring one
 * is how a plugin extends a screen it does not own.
 */

import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { PluginPrincipal } from "./index";
import { InvalidDefinitionError } from "./shared/errors";
import { assertNonEmptyId } from "./shared/validators";

/**
 * Named places in the host UI a plugin may contribute to.
 *
 * An open string: a plugin may target a slot the host does not publish yet, and
 * the host simply renders no contribution rather than failing the plugin.
 */
export type PluginSlotName =
  | "dashboard.service-card.trailing"
  | "service.workspace.after-header"
  | "sidebar.profile"
  | (string & {});

/**
 * Any slot binding, whatever plugin context and service type it was written
 * against.
 *
 * `render` is contravariant in both of its inputs, so a slot written for one
 * plugin and service shape is not assignable to a slot demanding another. The
 * host supplies both and has no use for the declared types.
 */
export type AnyPluginSlot = {
  readonly kind: "slot";
  readonly id: string;
  readonly slot: PluginSlotName;
  readonly order?: number;
  readonly render: (input: {
    readonly context: any;
    readonly principal?: PluginPrincipal;
    readonly service: any;
  }) =>
    | PageNode
    | readonly PageNode[]
    | Promise<PageNode | readonly PageNode[]>;
};

/** Input handed to a slot's render function. */
export type PluginSlotRenderInput<TContext, TService = unknown> = {
  readonly context: TContext;
  /** Authenticated caller; absent for anonymous requests. */
  readonly principal?: PluginPrincipal;
  readonly service: TService;
};

/** A slot contribution definition. */
export type PluginSlotDefinition<
  TContext,
  TService = unknown,
  TSlot extends string = PluginSlotName,
> = {
  readonly kind: "slot";
  readonly id: string;
  readonly slot: TSlot;
  readonly order?: number;
  readonly render: (
    input: PluginSlotRenderInput<TContext, TService>,
  ) => PageNode | readonly PageNode[] | Promise<PageNode | readonly PageNode[]>;
};

/**
 * Defines a contribution to a named host UI slot.
 *
 * @param options.id - Unique within the plugin, e.g. `"card-status"`.
 * @param options.slot - The slot name the host publishes.
 * @param options.order - Sort position among contributions to that slot.
 * @param options.render - Composes the nodes to contribute.
 * @throws {@link InvalidDefinitionError} for an empty id or slot.
 *
 * @example
 * ```ts
 * export const cardStatus = defineSlot({
 *   id: "card-status",
 *   slot: "dashboard.service-card.trailing",
 *   order: 50,
 *   render: async ({ context, service }) => {
 *     const probe = await context.services.probe(service.id);
 *     return [statusBadge({ status: probe?.status })];
 *   },
 * });
 * ```
 */
export function defineSlot<
  TContext,
  TService = unknown,
  TSlot extends string = PluginSlotName,
>(options: {
  id: string;
  slot: TSlot;
  order?: number;
  render: PluginSlotDefinition<TContext, TService, TSlot>["render"];
}): PluginSlotDefinition<TContext, TService, TSlot> {
  assertNonEmptyId("Slot", options.id);
  if (!options.slot)
    throw new InvalidDefinitionError("Slot name must be a non-empty string");
  return {
    kind: "slot",
    id: options.id,
    slot: options.slot,
    ...(options.order === undefined ? {} : { order: options.order }),
    render: options.render,
  };
}
