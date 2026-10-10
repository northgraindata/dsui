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
  | "overlay"
  | (string & {});

/** How an overlay contribution is positioned by the host UI. */
export type PluginOverlayPresentation =
  | { readonly mode: "modal"; readonly label?: string }
  | {
      readonly mode: "anchored";
      /** Stable host target id, never an arbitrary CSS selector. */
      readonly target: string;
      /** Navigate within the app before resolving the target. */
      readonly path?: string;
      /** Dim the screen around the target. */
      readonly highlight?: boolean;
      readonly placement?: "top" | "right" | "bottom" | "left";
      /** Keep the panel in a stable viewport corner while its target changes. */
      readonly dock?: "bottom-right";
      /** Advance after a successful interaction from the highlighted component. */
      readonly advanceOn?: {
        readonly serviceId?: string;
        readonly pluginId?: string;
        readonly target: string;
        readonly event: string;
        readonly overlay: string;
      };
      readonly label?: string;
    };

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
  readonly presentation?: PluginOverlayPresentation;
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
  readonly presentation?: PluginOverlayPresentation;
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
  presentation?: PluginOverlayPresentation;
  render: PluginSlotDefinition<TContext, TService, TSlot>["render"];
}): PluginSlotDefinition<TContext, TService, TSlot> {
  assertNonEmptyId("Slot", options.id);
  if (!options.slot)
    throw new InvalidDefinitionError("Slot name must be a non-empty string");
  if (options.slot === "overlay" && !options.presentation)
    throw new InvalidDefinitionError(
      'Overlay slots require a presentation, such as { mode: "modal" }',
    );
  if (options.slot !== "overlay" && options.presentation)
    throw new InvalidDefinitionError(
      "Only overlay slots may specify a presentation",
    );
  if (
    options.presentation?.mode === "anchored" &&
    !options.presentation.target.trim()
  )
    throw new InvalidDefinitionError("Anchored overlays require a target id");
  if (
    options.presentation?.mode === "anchored" &&
    options.presentation.placement !== undefined &&
    !["top", "right", "bottom", "left"].includes(options.presentation.placement)
  )
    throw new InvalidDefinitionError("Invalid anchored overlay placement");
  if (
    options.presentation &&
    options.presentation.mode !== "modal" &&
    options.presentation.mode !== "anchored"
  )
    throw new InvalidDefinitionError("Invalid overlay presentation mode");
  if (
    options.presentation?.mode === "anchored" &&
    options.presentation.path !== undefined &&
    (!options.presentation.path.startsWith("/") ||
      options.presentation.path.startsWith("//") ||
      Array.from(options.presentation.path).some(
        (character) => character === "\\" || character.charCodeAt(0) < 32,
      ))
  )
    throw new InvalidDefinitionError("Overlay paths must be local app paths");
  if (options.presentation?.mode === "anchored") {
    const { dock, advanceOn } = options.presentation;
    if (dock !== undefined && dock !== "bottom-right")
      throw new InvalidDefinitionError("Invalid overlay dock");
    if (
      advanceOn &&
      (!advanceOn.target.trim() ||
        !advanceOn.event.trim() ||
        !advanceOn.overlay.trim() ||
        (advanceOn.serviceId !== undefined && !advanceOn.serviceId.trim()) ||
        (advanceOn.pluginId !== undefined && !advanceOn.pluginId.trim()) ||
        (advanceOn.serviceId !== undefined && advanceOn.pluginId !== undefined))
    )
      throw new InvalidDefinitionError("Invalid overlay interaction binding");
  }
  return {
    kind: "slot",
    id: options.id,
    slot: options.slot,
    ...(options.order === undefined ? {} : { order: options.order }),
    ...(options.presentation ? { presentation: options.presentation } : {}),
    render: options.render,
  };
}
