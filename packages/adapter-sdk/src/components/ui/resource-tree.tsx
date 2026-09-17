import type {
  ResourceReference,
  ResourceTreeBranchDocument,
  PageTableRowLink as TableRowLink,
} from "@northgraindata/dsui-adapter-sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentClient,
  ComponentProps as RegistryViewProps,
} from "../runtime";
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

function relationIcon(type: string | undefined, depth: number): string {
  const normalizedType = type?.toLocaleLowerCase();
  if (depth === 0) return "database";
  if (depth === 1) return "folder";
  if (normalizedType === "view") return "eye";
  if (normalizedType === "materialized-view") return "layers";
  if (normalizedType === "sequence") return "hash";
  return "table";
}

function relationLabel(type: string): string {
  return type.toLocaleLowerCase().replaceAll("-", " ");
}

const GROUP_ORDER = [
  "table",
  "view",
  "materialized-view",
  "sequence",
  "foreign-table",
];

function groupLabel(type: string): string {
  const label = relationLabel(type);
  return `${label.slice(0, 1).toUpperCase()}${label.slice(1)}s`;
}

function groupedRows(
  rows: Record<string, unknown>[],
  typeField: string,
): Array<[string, Record<string, unknown>[]]> {
  const groups = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const type = String(row[typeField] ?? "objects").toLocaleLowerCase();
    groups.set(type, [...(groups.get(type) ?? []), row]);
  }
  return [...groups.entries()].sort(([left], [right]) => {
    const leftOrder = GROUP_ORDER.indexOf(left);
    const rightOrder = GROUP_ORDER.indexOf(right);
    if (leftOrder === -1 && rightOrder === -1) return left.localeCompare(right);
    if (leftOrder === -1) return 1;
    if (rightOrder === -1) return -1;
    return leftOrder - rightOrder;
  });
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
  client: ComponentClient;
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

  const renderRows = (items: Record<string, unknown>[]) =>
    items.map((row) => {
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
            className={`resource-tree-row group flex w-full min-h-7 items-center gap-1 px-1.5 ${
              selected ? "bg-accent/15 text-primary" : "text-secondary"
            } hover:bg-surface-hover hover:text-primary`}
          >
            {branch.children ? (
              <button
                type="button"
                className={`resource-tree-chevron-button ${open ? "is-open" : ""}`}
                aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
                aria-expanded={open}
                onClick={toggle}
              >
                <WorkbenchIcon name="chevron" size={18} />
              </button>
            ) : null}
            <button
              type="button"
              className="resource-tree-link"
              title={nextLabels.join(".")}
              onClick={activate}
            >
              <WorkbenchIcon
                name={relationIcon(
                  String(row[branch.typeField ?? "type"] ?? ""),
                  depth,
                )}
                size={15}
              />
              <span className="resource-tree-name">{name}</span>
            </button>
            {row[branch.typeField ?? "type"] && branch.children ? (
              <span className="resource-tree-type ml-auto">
                {relationLabel(String(row[branch.typeField ?? "type"]))}
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
    });

  const typeField = branch.typeField ?? "type";
  const groups = !branch.children ? groupedRows(rows, typeField) : [];
  return (
    <ul className="m-0 list-none p-0" role={depth ? "group" : "tree"}>
      {groups.length > 1 ||
      (groups.length === 1 && groups[0]?.[0] !== "objects")
        ? groups.map(([type, items]) => {
            const key = [...labels, `@${type}`].join("/");
            const collapsedKey = `collapsed:${key}`;
            const open = needle ? true : !expanded.has(collapsedKey);
            const toggle = () => {
              const next = new Set(expanded);
              if (next.has(collapsedKey)) next.delete(collapsedKey);
              else next.add(collapsedKey);
              setExpanded(next);
            };
            return (
              <li className="resource-tree-section" key={key}>
                <button
                  type="button"
                  className="resource-tree-section-row"
                  aria-expanded={open}
                  onClick={toggle}
                >
                  <span
                    className={`resource-tree-section-chevron ${open ? "is-open" : ""}`}
                    aria-hidden="true"
                  >
                    <WorkbenchIcon name="chevron" size={18} />
                  </span>
                  <WorkbenchIcon name={relationIcon(type, depth)} size={15} />
                  <span>{groupLabel(type)}</span>
                  <span className="resource-tree-count">{items.length}</span>
                </button>
                {open ? (
                  <ul className="resource-tree-section-items">
                    {renderRows(items)}
                  </ul>
                ) : null}
              </li>
            );
          })
        : renderRows(rows)}
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

export function ResourceTree({
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
      <div className="resource-tree-search-wrap">
        <WorkbenchIcon name="search" size={15} />
        <input
          id={`${stateKey ?? "resource-tree"}-search`}
          type="search"
          aria-label="Search schemas, tables, columns"
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

export default ResourceTree;
