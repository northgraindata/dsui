import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentClient } from "../../runtime";
import { parseQueryResult, type QueryResultView } from "./query-result";

type QueryTab = {
  id: number;
  sql: string;
  result?: QueryResultView;
  error?: string;
  running: boolean;
};

export function useQueryWorkspace(
  client: ComponentClient,
  action: { readonly actionId: string; readonly input?: unknown },
  initialSql: string,
) {
  const sequence = useRef(1);
  const inFlight = useRef(new Set<number>());
  const controllers = useRef(new Map<number, AbortController>());
  useEffect(
    () => () => {
      for (const controller of controllers.current.values()) controller.abort();
    },
    [],
  );
  const [tabs, setTabs] = useState<QueryTab[]>([
    { id: 1, sql: initialSql, running: false },
  ]);
  const [activeId, setActiveId] = useState(1);
  const tab = tabs.find((item) => item.id === activeId) ?? tabs[0];
  const updateTab = useCallback((id: number, change: Partial<QueryTab>) => {
    setTabs((items) =>
      items.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  }, []);
  const setSql = useCallback(
    (sql: string) => updateTab(activeId, { sql }),
    [activeId, updateTab],
  );
  const run = useCallback(async () => {
    if (!tab?.sql.trim() || inFlight.current.has(tab.id)) return;
    const id = tab.id;
    inFlight.current.add(id);
    const controller = new AbortController();
    controllers.current.set(id, controller);
    updateTab(id, { running: true, error: undefined, result: undefined });
    const started = performance.now();
    try {
      const response = await client.executeAction(
        {
          ...action,
          input: {
            ...(typeof action.input === "object" && action.input !== null
              ? action.input
              : {}),
            sql: tab.sql,
          },
        },
        { signal: controller.signal },
      );
      if (response.status !== "success")
        throw new Error(response.message ?? "Query failed");
      const result = parseQueryResult(response.data);
      updateTab(id, {
        result: {
          ...result,
          elapsedMs: result.elapsedMs ?? performance.now() - started,
        },
      });
    } catch (cause) {
      updateTab(id, {
        error: cause instanceof Error ? cause.message : "Query failed",
      });
    } finally {
      inFlight.current.delete(id);
      controllers.current.delete(id);
      updateTab(id, { running: false });
    }
  }, [action, client, tab, updateTab]);
  const closeTab = useCallback(
    (id: number) => {
      controllers.current.get(id)?.abort();
      const remaining = tabs.filter((entry) => entry.id !== id);
      setTabs(remaining);
      if (activeId === id && remaining[0]) setActiveId(remaining[0].id);
    },
    [activeId, tabs],
  );
  const newTab = useCallback(() => {
    const id = ++sequence.current;
    setTabs((items) => [...items, { id, sql: "", running: false }]);
    setActiveId(id);
  }, []);
  return {
    tabs,
    tab,
    activeId,
    setActiveId,
    setSql,
    run,
    cancel: () => controllers.current.get(activeId)?.abort(),
    closeTab,
    newTab,
  };
}
