import { useEffect, useState } from "react";
import { runOperation } from "../api";

export type PollingResult = {
  data?: unknown;
  columns?: string[];
  error?: string;
};

export function usePolling(
  serviceId: string,
  capability: string,
  intervalMs: number,
  enabled = true,
): PollingResult {
  const [state, setState] = useState<PollingResult>({});

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () =>
      runOperation(serviceId, capability, {})
        .then((res) => {
          if (active) setState({ data: res.data, columns: res.columns });
        })
        .catch((error) => {
          if (active) {
            setState({
              error: error instanceof Error ? error.message : "Failed to load",
            });
          }
        });

    load();
    const timer = setInterval(load, intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [serviceId, capability, intervalMs, enabled]);

  return state;
}
