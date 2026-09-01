import { cn, Input } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { runOperation, type Service } from "../api";
import { rowsToRecords } from "../result-data";
import type { ServiceView } from "../workspace-navigation";
import { Icon } from "./Icon";
import { TableWorkspace } from "./TableWorkspace";

type ExplorerConfig = NonNullable<ServiceView["databaseExplorer"]>;
type Selection = { database: string; objectName: string; tabId: string };

export function DatabaseExplorer({
  service,
  viewId,
  config,
  selection,
}: {
  service: Service;
  viewId: string;
  config: ExplorerConfig;
  selection?: Selection;
}) {
  const [databases, setDatabases] = useState<Record<string, unknown>[]>([]);
  const [objects, setObjects] = useState<
    Record<string, Record<string, unknown>[]>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadingDatabases, setLoadingDatabases] = useState(true);
  const [loadingObjects, setLoadingObjects] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let live = true;
    runOperation(service.id, config.databasesCapability, {})
      .then((response) => {
        if (live)
          setDatabases(rowsToRecords(response.data, response.columns ?? []));
      })
      .catch(
        (reason) =>
          live &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load databases",
          ),
      )
      .finally(() => live && setLoadingDatabases(false));
    return () => {
      live = false;
    };
  }, [config.databasesCapability, service.id]);

  const loadObjects = useCallback(
    (database: string) => {
      if (objects[database] || loadingObjects.has(database)) return;
      setLoadingObjects((current) => new Set(current).add(database));
      runOperation(service.id, config.objectsCapability, { database })
        .then((response) =>
          setObjects((current) => ({
            ...current,
            [database]: rowsToRecords(response.data, response.columns ?? []),
          })),
        )
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load database objects",
          ),
        )
        .finally(() =>
          setLoadingObjects((current) => {
            const next = new Set(current);
            next.delete(database);
            return next;
          }),
        );
    },
    [config.objectsCapability, loadingObjects, objects, service.id],
  );

  useEffect(() => {
    const database = selection?.database;
    if (!database) return;
    setExpanded((current) => new Set(current).add(database));
    loadObjects(database);
  }, [loadObjects, selection?.database]);

  const needle = filter.trim().toLowerCase();
  const visibleDatabases = useMemo(
    () =>
      databases.filter((database) => {
        if (!needle) return true;
        const id = String(database[config.databaseIdField] ?? "");
        return (
          id.toLowerCase().includes(needle) ||
          (objects[id] ?? []).some((object) =>
            String(object[config.objectNameField] ?? "")
              .toLowerCase()
              .includes(needle),
          )
        );
      }),
    [
      config.databaseIdField,
      config.objectNameField,
      databases,
      needle,
      objects,
    ],
  );

  return (
    <div className="grid min-h-[620px] grid-cols-1 overflow-hidden border border-border bg-surface md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-border bg-canvas md:border-r md:border-b-0">
        <div className="border-b border-border p-3">
          <label
            htmlFor="database-object-filter"
            className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-muted"
          >
            Databases and objects
          </label>
          <Input
            id="database-object-filter"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter objects"
            className="mt-2 font-mono text-[11px]"
          />
        </div>
        <div className="max-h-[320px] min-h-0 flex-1 overflow-auto p-2 font-mono text-[11.5px] md:max-h-none">
          {error ? (
            <p role="alert" className="px-2 text-unavailable">
              {error}
            </p>
          ) : null}
          {loadingDatabases ? (
            <div aria-busy="true" className="grid gap-2 p-2">
              <span className="h-2.5 animate-pulse bg-surface-hover motion-reduce:animate-none" />
              <span className="h-2.5 w-2/3 animate-pulse bg-surface-hover motion-reduce:animate-none" />
            </div>
          ) : visibleDatabases.length ? (
            visibleDatabases.map((database) => {
              const id = String(database[config.databaseIdField] ?? "");
              const open = expanded.has(id) || Boolean(needle);
              const databaseObjects = objects[id] ?? [];
              return (
                <div key={id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => {
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                      if (!open) loadObjects(id);
                    }}
                    className="flex w-full items-center gap-1.5 px-1.5 py-1.5 text-left text-secondary hover:bg-surface-hover hover:text-primary"
                  >
                    <span
                      className={cn(
                        "transition-transform",
                        open ? "rotate-90" : "",
                      )}
                    >
                      <Icon name="chevron" size={12} />
                    </span>
                    <Icon name="database" size={13} />
                    <span className="truncate">{id}</span>
                  </button>
                  {open ? (
                    <div className="pl-5">
                      {loadingObjects.has(id) ? (
                        <p className="px-2 py-1 text-muted">Loading…</p>
                      ) : databaseObjects.length ? (
                        databaseObjects
                          .filter((object) =>
                            needle
                              ? String(object[config.objectNameField] ?? "")
                                  .toLowerCase()
                                  .includes(needle)
                              : true,
                          )
                          .map((object) => {
                            const name = String(
                              object[config.objectNameField] ?? "",
                            );
                            const type = String(
                              object[config.objectTypeField] ?? "table",
                            );
                            const active =
                              selection?.database === id &&
                              selection.objectName === name;
                            return (
                              <Link
                                key={`${type}:${name}`}
                                to="/services/$serviceId/$viewId/$database/$objectName/$tabId"
                                params={{
                                  serviceId: service.id,
                                  viewId,
                                  database: id,
                                  objectName: name,
                                  tabId: "overview",
                                }}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-1.5 no-underline hover:bg-surface-hover hover:text-primary",
                                  active
                                    ? "bg-surface-hover text-primary"
                                    : "text-muted",
                                )}
                              >
                                <Icon
                                  name={type === "table" ? "grid" : "folder"}
                                  size={12}
                                />
                                <span className="truncate">{name}</span>
                                <span className="ml-auto text-[8.5px] uppercase text-muted">
                                  {type}
                                </span>
                              </Link>
                            );
                          })
                      ) : (
                        <p className="px-2 py-1 text-muted">No objects.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p role="status" className="px-2 text-muted">
              No databases found.
            </p>
          )}
        </div>
      </aside>
      {selection ? (
        <TableWorkspace
          key={`${selection.database}:${selection.objectName}:${selection.tabId}`}
          serviceId={service.id}
          viewId={viewId}
          database={selection.database}
          objectName={selection.objectName}
          objectType={String(
            objects[selection.database]?.find(
              (object) =>
                object[config.objectNameField] === selection.objectName,
            )?.[config.objectTypeField] ?? "table",
          )}
          tabId={selection.tabId}
          config={config}
        />
      ) : (
        <div className="grid place-content-center p-8 text-center">
          <Icon name="database" size={28} />
          <h2 className="mt-4 mb-0 text-[14px] font-semibold text-primary">
            Select a table
          </h2>
          <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-muted">
            Expand a database to inspect its objects, columns, data, DDL, and
            storage parts.
          </p>
        </div>
      )}
    </div>
  );
}
