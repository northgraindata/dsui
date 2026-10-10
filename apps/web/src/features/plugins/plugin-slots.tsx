import type { PluginSlotResult } from "@northgraindata/dsui-plugin-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { type ReactNode, useEffect, useState } from "react";
import { getPluginSlots } from "../../api";
import { pluginRendererClient } from "./plugin-client";
import { PluginErrorBoundary } from "./plugin-error-boundary";

const hostRenderedSlots = new Set([
  "dashboard.service-card.trailing",
  "service.workspace.after-header",
  "sidebar.profile",
]);

export function usePluginSlotBatch(slot: string, serviceIdsKey?: string) {
  const [results, setResults] = useState<PluginSlotResult[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    setResults([]);
    setError(undefined);
    if (serviceIdsKey === "") return;
    const serviceIds = serviceIdsKey?.split("\0") ?? [];
    const batches =
      serviceIdsKey === undefined ? [getPluginSlots(slot, [])] : [];
    for (let offset = 0; offset < serviceIds.length; offset += 100)
      batches.push(
        getPluginSlots(slot, serviceIds.slice(offset, offset + 100)),
      );
    Promise.all(batches)
      .then(
        (responses) =>
          active && setResults(responses.flatMap((response) => response.items)),
      )
      .catch(() => active && setError("Plugin widgets could not be loaded"));
    return () => {
      active = false;
    };
  }, [slot, serviceIdsKey]);
  return { results, error };
}

export function PluginSlot({
  serviceId,
  results,
  error,
  fallback,
}: {
  serviceId: string;
  results: PluginSlotResult[];
  error?: string;
  fallback?: ReactNode;
}) {
  const selected = results.filter(
    (result) =>
      result.serviceId === serviceId && hostRenderedSlots.has(result.slot),
  );
  if (!selected.some((item) => !item.error && item.nodes.length) && fallback)
    return <>{fallback}</>;
  if (!selected.length && !error) return null;
  return (
    <div className="plugin-slot">
      {error && <span role="alert">{error}</span>}
      {selected.map((item) => (
        <div key={`${item.pluginId}/${item.slotId}`}>
          {item.error ? (
            <span role="alert">{item.error}</span>
          ) : (
            <PluginErrorBoundary>
              <DeclarativePageRenderer
                nodes={item.nodes}
                client={pluginRendererClient(item.pluginId, (path) =>
                  window.location.assign(
                    `/plugins/${encodeURIComponent(item.pluginId)}/${path.replace(/^\/+/, "")}`,
                  ),
                )}
              />
            </PluginErrorBoundary>
          )}
        </div>
      ))}
    </div>
  );
}
