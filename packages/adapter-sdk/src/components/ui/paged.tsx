import { Button, Select } from "@northgraindata/dsui-ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DataSource } from "../../resource";
import type { ServerPagination } from "../primitives/paging";
import type { ComponentProps } from "../runtime";
import { WorkbenchIcon } from "./icons";
import {
  initialPageState,
  lastOffset,
  type PageState,
  pageRequest,
  pageSummary,
  readPage,
} from "./page-state";

/** How long typing must pause before a search is sent. */
const SEARCH_DELAY_MS = 300;

/**
 * One page of a server-paged source. The previous page stays on screen while
 * the next one loads, so the content below does not jump.
 */
export function usePagedSource(
  client: ComponentProps["client"],
  source: DataSource | undefined,
  paging: ServerPagination | undefined,
) {
  // Another source, such as another DAG's runs, starts from its first page.
  const [owned, setOwned] = useState(() => ({
    source,
    state: initialPageState(paging?.pageSize),
  }));
  const state =
    owned.source === source ? owned.state : initialPageState(paging?.pageSize);
  if (owned.source !== source) setOwned({ source, state });
  const setState = useCallback(
    (change: (now: PageState) => PageState) =>
      setOwned((now) => ({ ...now, state: change(now.state) })),
    [],
  );
  const [typed, setTyped] = useState(state.search);
  const [page, setPage] = useState<ReturnType<typeof readPage>>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (typed.trim() === state.search.trim()) return;
    const timer = setTimeout(
      () => setState((now) => ({ ...now, search: typed, offset: 0 })),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [typed, state.search, setState]);

  const request = useMemo(
    () =>
      source && paging
        ? { ...source, input: pageRequest(source.input, state) }
        : undefined,
    [source, paging, state],
  );

  useEffect(() => {
    void version;
    if (!request) return;
    let active = true;
    const accept = (value: unknown) => {
      if (!active) return;
      const next = readPage(value);
      setLoading(false);
      if (!next) {
        setError("The source did not return a page of records.");
        return;
      }
      setError(undefined);
      // Records were removed and this page no longer exists.
      if (!next.items.length && request.input.offset && next.total)
        setState((now) => ({
          ...now,
          offset: lastOffset(next.total, now.size),
        }));
      else setPage(next);
    };
    const fail = (cause: unknown) => {
      if (!active) return;
      setLoading(false);
      setError(
        cause instanceof Error ? cause.message : "Could not load records",
      );
    };
    setLoading(true);
    if (request.refresh?.kind === "poll" && client.watchResource) {
      const stop = client.watchResource(request, accept, fail);
      return () => {
        active = false;
        stop();
      };
    }
    client.executeResource(request).then(accept, fail);
    return () => {
      active = false;
    };
  }, [client, request, version, setState]);

  const narrowed =
    state.search.trim() !== "" || Object.values(state.filters).some(Boolean);
  return {
    page,
    error,
    loading,
    state,
    setState,
    typed,
    setTyped,
    narrowed,
    clear: () => {
      setTyped("");
      setState((now) => ({ ...now, search: "", filters: {}, offset: 0 }));
    },
    reload: () => setVersion((value) => value + 1),
  };
}

export type PagedSource = ReturnType<typeof usePagedSource>;

export function PagedToolbar({
  paging,
  paged,
}: {
  paging: ServerPagination;
  paged: PagedSource;
}) {
  if (!paging.search && !paging.filters?.length) return null;
  return (
    <div className="dsui-paged-toolbar">
      {paging.search ? (
        <label className="dsui-list-search">
          <WorkbenchIcon name="search" size={14} />
          <input
            type="search"
            value={paged.typed}
            onChange={(event) => paged.setTyped(event.target.value)}
            placeholder={paging.search}
            aria-label={paging.search}
          />
        </label>
      ) : null}
      {paging.filters?.map((filter) => (
        <Select
          key={filter.param}
          ariaLabel={filter.label}
          // Radix keeps "" for "nothing chosen", so "any" has its own value.
          value={paged.state.filters[filter.param] || "*"}
          onValueChange={(next) =>
            paged.setState((now) => ({
              ...now,
              offset: 0,
              filters: {
                ...now.filters,
                [filter.param]: next === "*" ? "" : next,
              },
            }))
          }
          options={[{ label: filter.label, value: "*" }, ...filter.options]}
        />
      ))}
    </div>
  );
}

export function Pager({ paged }: { paged: PagedSource }) {
  const total = paged.page?.total ?? 0;
  const shown = paged.page?.items.length ?? 0;
  const { offset, size } = paged.state;
  const move = (next: number) =>
    paged.setState((now) => ({ ...now, offset: next }));
  return (
    <nav className="dsui-pager" aria-label="Pages">
      <span aria-live="polite">{pageSummary(offset, shown, total)}</span>
      <Button
        variant="ghost"
        size="small"
        disabled={offset === 0 || paged.loading}
        onClick={() => move(Math.max(0, offset - size))}
      >
        Previous
      </Button>
      <Button
        variant="ghost"
        size="small"
        disabled={offset + size >= total || paged.loading}
        onClick={() => move(offset + size)}
      >
        Next
      </Button>
    </nav>
  );
}
