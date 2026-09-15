import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { useCallback, useEffect, useState } from "react";
import type { Activity } from "../activity";
import type {
  BucketInfo,
  ObjectPage,
  S3Bucket,
  S3ObjectDetails,
} from "../context";
import { ObjectInspector } from "./inspector";
import { OperationDialog } from "./operation-dialog";
import "./workspace.css";

export type Operation =
  | "Upload"
  | "Create folder"
  | "Delete"
  | "Copy"
  | "Move"
  | "Presigned URL"
  | "Download";
export const bytes = (n: number) => {
  const i = n > 0 ? Math.min(4, Math.floor(Math.log2(n) / 10)) : 0;
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KiB", "MiB", "GiB", "TiB"][i]}`;
};
export const date = (value: string) =>
  value ? new Date(value).toLocaleString() : "—";

export default function StorageWorkspace({ client, node }: ComponentProps) {
  const props = node.kind === "custom" ? node.props.props : undefined;
  const mode = String(props?.mode ?? "explorer");
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [bucket, setBucket] = useState(String(props?.bucket ?? ""));
  const [prefix, setPrefix] = useState(String(props?.prefix ?? ""));
  const [page, setPage] = useState<ObjectPage>({ rows: [] });
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [focused, setFocused] = useState<string>();
  const [info, setInfo] = useState<BucketInfo>();
  const [details, setDetails] = useState<S3ObjectDetails>();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, refresh] = useState(0);
  const [operation, setOperation] = useState<Operation>();
  const [descending, setDescending] = useState(false);
  const fail = useCallback(
    (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    [],
  );
  useEffect(() => {
    let active = true;
    client
      .executeResource({ resourceId: "s3-buckets" })
      .then((value) => {
        if (!active) return;
        const data = value as S3Bucket[];
        setBuckets(data);
        setBucket((current) => current || data[0]?.name || "");
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [client, fail]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly reloads server data after a completed operation.
  useEffect(() => {
    let active = true;
    client
      .executeAction({ actionId: "s3-read-activity" })
      .then((result) => {
        if (active && result.status === "success")
          setActivity(result.data as Activity[]);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [client, revision, fail]);
  const token = tokens.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly reloads server data after a completed operation.
  useEffect(() => {
    if (!bucket) return;
    let active = true;
    setLoading(true);
    setError("");
    setSelected([]);
    setFocused(undefined);
    setDetails(undefined);
    client
      .executeResource({
        resourceId: "s3-objects",
        input: {
          bucket,
          prefix: search || prefix,
          search: Boolean(search),
          token,
        },
      })
      .then((value) => {
        if (active) setPage(value as ObjectPage);
      })
      .catch((e) => {
        if (active) fail(e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bucket, prefix, search, token, client, revision, fail]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly reloads server data after a completed operation.
  useEffect(() => {
    if (!bucket) return;
    let active = true;
    setInfo(undefined);
    client
      .executeResource({ resourceId: "s3-bucket-info", input: { bucket } })
      .then((value) => {
        if (active) setInfo(value as BucketInfo);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [bucket, client, revision, fail]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly reloads server data after a completed operation.
  useEffect(() => {
    setDetails(undefined);
    if (!focused) return;
    let active = true;
    client
      .executeResource({
        resourceId: "s3-object-details",
        input: { bucket, key: focused },
      })
      .then((value) => {
        if (active) setDetails(value as S3ObjectDetails);
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [focused, bucket, client, revision, fail]);
  const openPrefix = (value: string) => {
    setSelected([]);
    setFocused(undefined);
    setDetails(undefined);
    setPrefix(value);
    setSearch("");
    setDraft("");
    setTokens([undefined]);
  };
  const keys = selected.length ? selected : focused ? [focused] : [];
  const rows = [...page.rows].sort((a, b) =>
    a.type === b.type
      ? a.name.localeCompare(b.name) * (descending ? -1 : 1)
      : a.type === "folder"
        ? -1
        : 1,
  );
  const allKeys = rows.filter((r) => r.type === "object").map((r) => r.key);
  const choose = (key: string) =>
    setSelected((current) =>
      current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key],
    );
  const metrics = [
    ["Buckets", buckets.length],
    [
      "Objects in bucket",
      info ? `${info.objectCount}${info.partial ? "+" : ""}` : "—",
    ],
    [
      "Bucket storage",
      info ? `${bytes(info.size)}${info.partial ? "+" : ""}` : "—",
    ],
    ["Versioning", info?.versioning ?? "—"],
    [
      "Multipart uploads",
      info && info.multipartUploads >= 0
        ? `${info.multipartUploads}${info.multipartPartial ? "+" : ""}`
        : "Unavailable",
    ],
    ["Regions", new Set(buckets.map((b) => b.region)).size],
  ];
  return (
    <div className="s3-workspace">
      <div className="s3-metrics">
        {metrics.map(([label, value]) => (
          <div className="s3-metric" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      {info?.partial && (
        <p className="s3-note">
          Storage totals cover the first 1,000 objects in {bucket}.
        </p>
      )}
      {error && (
        <div className="s3-error" role="alert">
          {error}
          <button type="button" onClick={() => refresh((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}
      <div className="s3-columns">
        <section className="s3-panel s3-browser">
          <header className="s3-panel-header">
            <div>
              <h2>
                {mode === "activity"
                  ? "Activity"
                  : mode === "policies"
                    ? "Bucket configuration"
                    : mode === "uploads"
                      ? "Uploads"
                      : "Bucket explorer"}
              </h2>
              <p>
                {mode === "activity"
                  ? "Recent operations performed through DSUI."
                  : "Browse and manage objects in your buckets."}
              </p>
            </div>
            <select
              aria-label="Switch bucket"
              value={bucket}
              onChange={(e) => {
                setBucket(e.target.value);
                openPrefix("");
              }}
            >
              {buckets.map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </select>
          </header>
          {bucket && (
            <p className="s3-note">
              {bucket} · {buckets.find((b) => b.name === bucket)?.region} ·
              Created{" "}
              {date(buckets.find((b) => b.name === bucket)?.createdAt ?? "")}
            </p>
          )}
          {mode === "activity" ? (
            <ActivityList entries={activity} />
          ) : mode === "policies" ? (
            <>
              <h3>Versioning</h3>
              <p>{info?.versioning ?? "Loading…"}</p>
              <h3>Default encryption</h3>
              <p>{info?.encryption ?? "Loading…"}</p>
              <h3>Bucket policy</h3>
              <pre>{info?.policy ?? "Loading…"}</pre>
            </>
          ) : (
            <>
              <nav className="s3-breadcrumb" aria-label="Object path">
                <button
                  type="button"
                  onClick={() => client.navigate("/buckets")}
                >
                  Buckets
                </button>
                <span>/</span>
                <button type="button" onClick={() => openPrefix("")}>
                  {bucket || "Select a bucket"}
                </button>
                {prefix
                  .split("/")
                  .filter(Boolean)
                  .map((part, i, parts) => (
                    <span key={parts.slice(0, i + 1).join("/")}>
                      <span> / </span>
                      <button
                        type="button"
                        onClick={() =>
                          openPrefix(`${parts.slice(0, i + 1).join("/")}/`)
                        }
                      >
                        {part}
                      </button>
                    </span>
                  ))}
              </nav>
              <div className="s3-toolbar">
                <button
                  type="button"
                  className="s3-primary"
                  disabled={!bucket}
                  onClick={() => setOperation("Upload")}
                >
                  ↑ Upload
                </button>
                <button
                  type="button"
                  disabled={!bucket}
                  onClick={() => setOperation("Create folder")}
                >
                  Create folder
                </button>
                {(
                  [
                    "Download",
                    "Delete",
                    "Presigned URL",
                    "Copy",
                    "Move",
                  ] as Operation[]
                ).map((op) => (
                  <button
                    type="button"
                    key={op}
                    disabled={
                      !keys.length || (op !== "Delete" && keys.length !== 1)
                    }
                    onClick={() => setOperation(op)}
                  >
                    {op}
                  </button>
                ))}
                <button type="button" onClick={() => refresh((n) => n + 1)}>
                  Refresh
                </button>
              </div>
              <form
                className="s3-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSearch(draft);
                  setTokens([undefined]);
                }}
              >
                <input
                  aria-label="Search by key prefix"
                  placeholder="Search by key prefix in this bucket…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <button type="submit">Search</button>
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setDraft("");
                      setTokens([undefined]);
                    }}
                  >
                    Clear
                  </button>
                )}
              </form>
              {mode === "uploads" && (
                <p className="s3-note">
                  Upload files up to 5 MiB. Choose a destination prefix in the
                  upload form.
                </p>
              )}
              <div className="s3-table-wrap" aria-busy={loading}>
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Select all objects on page"
                          checked={
                            allKeys.length > 0 &&
                            allKeys.every((k) => selected.includes(k))
                          }
                          onChange={(e) =>
                            setSelected(e.target.checked ? allKeys : [])
                          }
                        />
                      </th>
                      <th>
                        <button
                          type="button"
                          onClick={() => setDescending(!descending)}
                        >
                          Name {descending ? "↓" : "↑"}
                        </button>
                      </th>
                      <th>Type</th>
                      <th>Size</th>
                      <th>Last modified</th>
                      <th>Storage class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading &&
                      rows.map((row) => (
                        <tr
                          key={row.key}
                          data-selected={
                            selected.includes(row.key) || focused === row.key
                          }
                        >
                          <td>
                            {row.type === "object" && (
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.name}`}
                                checked={selected.includes(row.key)}
                                onChange={() => choose(row.key)}
                              />
                            )}
                          </td>
                          <td>
                            <button
                              className="s3-object-name"
                              type="button"
                              onClick={() =>
                                row.type === "folder"
                                  ? openPrefix(row.key)
                                  : setFocused(row.key)
                              }
                            >
                              {row.name}
                              {row.type === "folder" ? "/" : ""}
                            </button>
                          </td>
                          <td>
                            {row.type === "folder"
                              ? "Folder"
                              : row.name.includes(".")
                                ? row.name.split(".").at(-1)?.toUpperCase()
                                : "Object"}
                          </td>
                          <td>{row.size === null ? "—" : bytes(row.size)}</td>
                          <td>{date(row.lastModified)}</td>
                          <td>
                            {row.storageClass && (
                              <span className="s3-badge">
                                {row.storageClass}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {loading ? (
                  <p className="s3-empty">Loading objects…</p>
                ) : (
                  !rows.length && (
                    <p className="s3-empty">
                      {search
                        ? "No objects match this key prefix."
                        : "This prefix is empty. Upload a file to get started."}
                    </p>
                  )
                )}
              </div>
              <footer className="s3-pagination">
                <span>{selected.length} objects selected</span>
                <span>
                  Page {tokens.length} · {page.rows.length} entries
                </span>
                <button
                  type="button"
                  disabled={loading || tokens.length === 1}
                  onClick={() => setTokens((t) => t.slice(0, -1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={loading || !page.nextToken}
                  onClick={() => setTokens((t) => [...t, page.nextToken])}
                >
                  Next
                </button>
              </footer>
            </>
          )}
        </section>
        <aside className="s3-rail">
          <ObjectInspector
            client={client}
            bucket={bucket}
            objectKey={focused}
            details={details}
          />
          <section className="s3-panel">
            <header className="s3-panel-header">
              <h2>Recent activity</h2>
              <button
                type="button"
                onClick={() => client.navigate("/activity")}
              >
                View all →
              </button>
            </header>
            <ActivityList entries={activity.slice(0, 5)} />
          </section>
        </aside>
      </div>
      {operation && (
        <OperationDialog
          client={client}
          operation={operation}
          bucket={bucket}
          prefix={prefix}
          keys={keys}
          buckets={buckets}
          close={() => setOperation(undefined)}
          done={() => {
            setOperation(undefined);
            refresh((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
function ActivityList({ entries }: { entries: Activity[] }) {
  return entries.length ? (
    <ul className="s3-activity">
      {entries.map((entry) => (
        <li key={entry.id}>
          <strong>
            {entry.operation} {entry.key}
          </strong>
          <span>
            {entry.bucket} · {date(entry.at)}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="s3-note">
      No operations recorded yet. Activity includes actions from this DSUI
      service only.
    </p>
  );
}
