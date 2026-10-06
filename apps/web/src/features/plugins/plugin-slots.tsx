import type { PluginSlotResult } from "@northgraindata/dsui-plugin-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useEffect, useState } from "react";
import { getPluginShellActions, getPluginSlots } from "../../api";
import { pluginRendererClient } from "./plugin-client";
import { PluginErrorBoundary } from "./plugin-error-boundary";

/** Global extension controls are contributed by plugins, just like service widgets. */
export function PluginShellActions() {
  const [items, setItems] = useState<
    Array<{
      pluginId: string;
      slotId: string;
      nodes: PluginSlotResult["nodes"];
    }>
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getPluginShellActions();
        if (active) {
          setItems(result.items);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, []);
  return (
    <div className="app-shell-actions">
      {error && (
        <span title="Extension controls could not be loaded" role="status">
          !
        </span>
      )}
      {items.map((item) => (
        <PluginErrorBoundary key={`${item.pluginId}/${item.slotId}`}>
          <DeclarativePageRenderer
            nodes={item.nodes}
            client={pluginRendererClient(item.pluginId, (path) =>
              window.location.assign(path),
            )}
          />
        </PluginErrorBoundary>
      ))}
    </div>
  );
}

export function usePluginSlotBatch(slot: string, serviceIdsKey: string) {
  const [results, setResults] = useState<PluginSlotResult[]>([]);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    setResults([]);
    setError(undefined);
    if (!serviceIdsKey) return;
    const serviceIds = serviceIdsKey.split("\0");
    const batches: ReturnType<typeof getPluginSlots>[] = [];
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
}: {
  serviceId: string;
  results: PluginSlotResult[];
  error?: string;
}) {
  const selected = results.filter((result) => result.serviceId === serviceId);
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
