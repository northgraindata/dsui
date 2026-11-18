import { z } from "zod";

export const signalEventSchema = z.object({
  id: z.string(),
  signalId: z.string(),
  type: z.enum(["info", "success", "warning", "error"]),
  sourceType: z.string(),
  sourceId: z.string(),
  serviceId: z.string().optional(),
  /**
   * The principal id of the person whose request caused the signal, such as
   * someone running a service action. Absent for background work, local
   * single-user mode and signals recorded before this field existed.
   */
  actor: z.string().optional(),
  payload: z.unknown(),
  occurredAt: z.string(),
});
export type PluginSignalEvent = z.infer<typeof signalEventSchema>;
export type PluginEventReadOptions = { cursor?: string; limit?: number };
export type PluginEventPage = {
  items: PluginSignalEvent[];
  cursor: string;
  hasMore: boolean;
};
