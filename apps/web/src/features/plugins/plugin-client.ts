import type { RendererClient } from "@northgraindata/dsui-renderer";
import { executePluginProcedure } from "../../api";

export function pluginRendererClient(
  pluginId: string,
  navigate: (path: string) => void,
): RendererClient {
  return {
    executeResource: async () => {
      throw new Error("Plugin pages must read data through plugin procedures.");
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
    navigate,
  };
}
