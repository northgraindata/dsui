import type {
  RefreshStrategy,
  ResourceReference,
} from "@northgraindata/dsui-adapter-sdk";
import type { RendererClient } from "@northgraindata/dsui-renderer";
import {
  executePluginProcedure,
  executePluginResource,
  getPluginResources,
} from "../../api";

/**
 * A plugin page's client.
 *
 * Identical in shape to an adapter service's client: both read resources and
 * run actions through the same `RendererClient` contract, so a component
 * written for an adapter renders in a plugin without knowing which it is in.
 */
export function pluginRendererClient(
  pluginId: string,
  navigate: (path: string) => void,
): RendererClient {
  // Policies come from the host so one fetch serves every resource the plugin
  // declares, and a serialized reference without one still refreshes correctly.
  let policies: Promise<Record<string, RefreshStrategy>> | undefined;
  const policyFor = (resourceId: string): Promise<RefreshStrategy> => {
    policies ??= getPluginResources(pluginId).then((resources) =>
      Object.fromEntries(
        resources.map((resource) => [resource.id, resource.refresh]),
      ),
    );
    return policies.then((all) => all[resourceId] ?? { kind: "manual" });
  };

  return {
    executeResource: async (reference) =>
      executePluginResource(pluginId, reference.resourceId, reference.input),
    watchResource: (reference, listener) => {
      let active = true;
      let running = false;
      let timer: number | undefined;

      const run = async () => {
        if (!active || running) return;
        running = true;
        try {
          listener(
            await executePluginResource(
              pluginId,
              reference.resourceId,
              reference.input,
            ),
          );
        } catch {
          // A failed refresh leaves the last good value on screen rather than
          // blanking the panel, which is how an adapter resource behaves too.
        } finally {
          running = false;
        }
      };

      const schedule = (refresh: RefreshStrategy) => {
        if (timer !== undefined) window.clearInterval(timer);
        if (refresh.kind !== "poll") return;
        timer = window.setInterval(() => void run(), refresh.intervalMs);
      };

      void (async () => {
        // A reference the host serialized already carries its policy, so the
        // catalog is only fetched when it does not.
        const refresh =
          reference.refresh ?? (await policyFor(reference.resourceId));
        if (!active) return;
        // Read first, then start the timer: a slow catalog must not delay the
        // data, and a fast one must not double-fetch.
        await run();
        if (active) schedule(refresh);
      })();

      return () => {
        active = false;
        if (timer !== undefined) window.clearInterval(timer);
      };
    },
    executeAction: async (reference) => {
      try {
        return {
          status: "success",
          data: await executePluginProcedure(
            pluginId,
            reference.actionId,
            reference.input,
          ),
        };
      } catch (cause) {
        return {
          status: "error",
          message:
            cause instanceof Error ? cause.message : "Plugin action failed",
        };
      }
    },
    executePluginProcedure: (procedureId, input) =>
      executePluginProcedure(pluginId, procedureId, input),
    notifyInteraction: (interaction) =>
      window.dispatchEvent(
        new CustomEvent("dsui:interaction", {
          detail: { ...interaction, pluginId },
        }),
      ),
    navigate,
    openOverlay: (overlayId) =>
      window.dispatchEvent(
        new CustomEvent("dsui:overlay-open", {
          detail: { pluginId, overlayId },
        }),
      ),
  };
}

export type { ResourceReference };
