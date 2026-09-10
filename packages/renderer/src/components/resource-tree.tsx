import type {
  ResourceReference,
  ResourceTreeBranchDocument,
  TableRowLink,
} from "@northgraindata/dsui-core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RegistryViewProps } from "../registry/view-registry";
import type { RendererClient } from "../types/renderer-types";
import { WorkbenchIcon } from "./icons";

export function resolveTreeTemplate(
  value: unknown,
  context: Record<string, unknown>,
): unknown {
  if (typeof value === "string" && value.startsWith("$"))
    return context[value.slice(1)] ?? value;
  if (Array.isArray(value))
    return value.map((item) => resolveTreeTemplate(item, context));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        resolveTreeTemplate(item, context),
      ]),
    );
  return value;
}

function resolveSource(
  source: ResourceReference,
  context: Record<string, unknown>,
): ResourceReference {
  return {
    resourceId: source.resourceId,
    ...(source.input === undefined
      ? {}
      : { input: resolveTreeTemplate(source.input, context) }),
  };
}

export function resolveTreeLink(
  link: TableRowLink | undefined,
  context: Record<string, unknown>,
): string | undefined {
  if (!link) return undefined;
  let path = link.path;
  for (const [param, field] of Object.entries(link.params)) {
    const value = context[field];
    if (value === undefined || value === null) return undefined;
    path = path.replace(`:${param}`, encodeURIComponent(String(value)));
  }
  return path;
}

function rowsFrom(data: unknown): Record<string, unknown>[] {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) && typeof row === "object" && !Array.isArray(row),
  );
}

function TreeBranch({
  client,
  branch,
  context,
  depth,
  labels,
  expanded,
  setExpanded,
  selectedPath,
  search,
  onLeafSelect,
}: {
  client: RendererClient;
  branch: ResourceTreeBranchDocument;
  context: Record<string, unknown>;
  depth: number;
  labels: string[];
  expanded: Set<string>;
  setExpanded(next: Set<string>): void;
  selectedPath?: string;
  search: string;
  onLeafSelect?(labels: string[]): void;
}) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState<string>();
  const contextKey = JSON.stringify(context);
  const source = useMemo(
    () => resolveSource(branch.source, JSON.parse(contextKey)),
    [branch.source, contextKey],
  );
  useEffect(() => {
    let active = true;
    setData(undefined);
    setError(undefined);
    client
      .executeResource(source)
      .then((result) => active && setData(result))
      .catch(
        (cause) =>
          active &&
          setError(
            cause instanceof Error ? cause.message : "Could not load objects",
          ),
      );
    return () => {
      active = false;
    };
  }, [client, source]);

  const needle = search.trim().toLocaleLowerCase();
  const rows = rowsFrom(data).filter((row) => {
    if (!needle || branch.children) return true;
    const name = String(row[branch.nameField ?? "name"] ?? "");
    return [...labels, name].join(".").toLocaleLowerCase().includes(needle);
  });

  if (error)
    return (
      <p className="m-1 px-2 py-1 text-[11px] text-unavailable" role="alert">
        {error}
      </p>
    );
  if (!data)
    return (
      <p className="m-1 px-2 py-1 text-[11px] text-secondary" aria-busy="true">
        Loading…
      </p>
    );
  if (!rows.length)
    return <p className="m-1 px-2 py-1 text-[11px] text-muted">No objects.</p>;

  return (
    <ul
      className={`m-0 list-none p-0 ${depth ? "ml-3 border-l border-border" : ""}`}
      role={depth ? "group" : "tree"}
    >
      {rows.map((row) => {
        const name = String(row[branch.nameField ?? "name"] ?? "Unnamed");
        const nextLabels = [...labels, name];
        const key = nextLabels.join("/");
        const nextContext = { ...context, ...row };
        const href = resolveTreeLink(branch.rowLink, nextContext);
        const open =
          expanded.has(key) ||
          Boolean(needle) ||
          Boolean(href && selectedPath?.startsWith(`${href}/`));
        const selected = href === selectedPath;
        const toggle = () => {
          const next = new Set(expanded);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          setExpanded(next);
        };
        const activate = () => {
          if (href) client.navigate(href);
          else if (branch.children) toggle();
          else onLeafSelect?.(nextLabels);
        };
        return (
          <li
            key={key}
            role="treeitem"
            tabIndex={-1}
            aria-expanded={branch.children ? open : undefined}
            aria-selected={selected || undefined}
          >
            <div
              className={`group flex min-h-7 items-center gap-1 px-1.5 ${
                selected ? "bg-accent/15 text-primary" : "text-secondary"
              } hover:bg-surface-hover hover:text-primary`}
            >
              {branch.children ? (
                <button
                  type="button"
                  aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
                  className="flex size-5 shrink-0 items-center justify-center bg-transparent text-muted"
                  onClick={toggle}
                >
                  <span aria-hidden="true">{open ? "▾" : "▸"}</span>
                </button>
              ) : (
                <span className="w-5 shrink-0 text-center text-[9px] text-muted">
                  {String(row[branch.typeField ?? "type"] ?? "").slice(0, 1)}
                </span>
              )}
              <button
                type="button"
                className="min-w-0 flex-1 truncate bg-transparent py-1 text-left font-mono text-[11.5px]"
                title={nextLabels.join(".")}
                onClick={activate}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" && branch.children && !open) {
                    event.preventDefault();
                    toggle();
                  } else if (
                    event.key === "ArrowLeft" &&
                    branch.children &&
                    open
                  ) {
                    event.preventDefault();
                    toggle();
                  }
                }}
              >
                <WorkbenchIcon
                  name={
                    branch.children
                      ? depth === 0
                        ? "database"
                        : "table"
                      : "table"
                  }
                  size={15}
                />
                {name}
              </button>
              {row[branch.typeField ?? "type"] ? (
                <span className="ml-auto text-[9px] uppercase tracking-wide text-muted">
                  {String(row[branch.typeField ?? "type"])}
                </span>
              ) : null}
            </div>
            {open && branch.children ? (
              <TreeBranch
                client={client}
                branch={branch.children}
                context={nextContext}
                depth={depth + 1}
                labels={nextLabels}
                expanded={expanded}
                setExpanded={setExpanded}
                selectedPath={selectedPath}
                search={search}
                onLeafSelect={onLeafSelect}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function readExpanded(stateKey: string | undefined): Set<string> {
  if (!stateKey || typeof sessionStorage === "undefined") return new Set();
  try {
    const value = JSON.parse(
      sessionStorage.getItem(`${stateKey}:expanded`) ?? "[]",
    );
    return new Set(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set();
  }
}

function readScroll(stateKey: string | undefined): number {
  if (!stateKey || typeof sessionStorage === "undefined") return 0;
  const value = Number(sessionStorage.getItem(`${stateKey}:scroll`) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function ResourceTreeView({
  client,
  node,
  onLeafSelect,
}: RegistryViewProps & { onLeafSelect?(labels: string[]): void }) {
  const stateKey =
    node.kind === "resource-tree" ? node.props.stateKey : undefined;
  const [search, setSearch] = useState("");
  const [expanded, setExpandedState] = useState(() => readExpanded(stateKey));
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = readScroll(stateKey);
  }, [stateKey]);
  const branch = useMemo(
    () => (node.kind === "resource-tree" ? node.props.branch : undefined),
    [node],
  );
  if (node.kind !== "resource-tree" || !branch) return null;
  const setExpanded = (next: Set<string>) => {
    setExpandedState(next);
    if (stateKey && typeof sessionStorage !== "undefined")
      sessionStorage.setItem(`${stateKey}:expanded`, JSON.stringify([...next]));
  };
  return (
    <section
      className="resource-tree flex min-h-0 flex-col"
      aria-label={node.props.label}
    >
      <header className="resource-tree-heading">
        <h2>Explorer</h2>
      </header>
      <div className="border-b border-border p-2.5">
        <label
          className="sr-only"
          htmlFor={`${stateKey ?? "resource-tree"}-search`}
        >
          Search data objects
        </label>
        <input
          id={`${stateKey ?? "resource-tree"}-search`}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={node.props.searchPlaceholder ?? "Search data…"}
          className="resource-tree-search"
        />
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto p-2"
        onScroll={(event) => {
          if (stateKey && typeof sessionStorage !== "undefined")
            sessionStorage.setItem(
              `${stateKey}:scroll`,
              String(event.currentTarget.scrollTop),
            );
        }}
      >
        <TreeBranch
          client={client}
          branch={branch}
          context={{}}
          depth={0}
          labels={[]}
          expanded={expanded}
          setExpanded={setExpanded}
          selectedPath={node.props.selectedPath}
          search={search}
          onLeafSelect={onLeafSelect}
        />
      </div>
    </section>
  );
}
