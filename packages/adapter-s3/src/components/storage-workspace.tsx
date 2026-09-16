import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { useCallback, useEffect, useState } from "react";
import type { ObjectPage, S3Bucket, S3Object } from "../context";
import "./workspace.css";

export const bytes = (n: number) => {
  const i = n > 0 ? Math.min(4, Math.floor(Math.log2(n) / 10)) : 0;
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${["B", "KiB", "MiB", "GiB", "TiB"][i]}`;
};

const date = (value: string) =>
  value ? new Date(value).toLocaleString() : "—";

const typeLabel = (row: S3Object) => {
  if (row.type === "folder") return "Folder";
  const extension = row.name.split(".").at(-1);
  if (extension && extension !== row.name) return extension.toUpperCase();
  return row.contentType?.split("/").at(-1)?.toUpperCase() || "Object";
};

export default function StorageWorkspace({ client, node }: ComponentProps) {
  const props = node.kind === "custom" ? node.props.props : undefined;
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [bucket, setBucket] = useState(String(props?.bucket ?? ""));
  const [prefix, setPrefix] = useState(String(props?.prefix ?? ""));
  const [page, setPage] = useState<ObjectPage>({ rows: [] });
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string>();
  const [revision, refresh] = useState(0);

  const fail = useCallback(
    (value: unknown) =>
      setError(value instanceof Error ? value.message : String(value)),
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

  const token = tokens.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision explicitly reloads the file list.
  useEffect(() => {
    if (!bucket) return;
    let active = true;
    setLoading(true);
    setError("");
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
      .catch((value) => {
        if (active) fail(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [bucket, prefix, search, token, client, revision, fail]);

  const openPrefix = (value: string) => {
    setPrefix(value);
    setSearch("");
    setDraft("");
    setTokens([undefined]);
  };

  const download = async (key: string) => {
    setDownloading(key);
    setError("");
    try {
      const result = await client.executeAction({
        actionId: "s3-presign-get",
        input: { bucket, key, expiresIn: 300 },
      });
      if (result.status !== "success")
        throw new Error(result.message || "Unable to prepare download");
      const link = document.createElement("a");
      link.href = String((result.data as { url: string }).url);
      link.download = key.split("/").at(-1) || key;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (value) {
      fail(value);
    } finally {
      setDownloading(undefined);
    }
  };

  const downloadFolder = async (prefix: string) => {
    setDownloading(prefix);
    setError("");
    try {
      const result = await client.executeAction({
        actionId: "s3-download-folder-zip",
        input: { bucket, prefix },
      });
      if (result.status !== "success")
        throw new Error(result.message || "Unable to prepare folder download");
      const data = result.data as { base64: string; filename: string };
      const bytes = Uint8Array.from(atob(data.base64), (char) =>
        char.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "application/zip" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (value) {
      fail(value);
    } finally {
      setDownloading(undefined);
    }
  };

  const rows = [...page.rows].sort((a, b) =>
    a.type === b.type
      ? a.name.localeCompare(b.name)
      : a.type === "folder"
        ? -1
        : 1,
  );
  const currentRegion = buckets.find((item) => item.name === bucket)?.region;
  const parts = prefix.split("/").filter(Boolean);

  return (
    <div className="s3-workspace">
      {error && (
        <div className="s3-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => refresh((value) => value + 1)}>
            Retry
          </button>
        </div>
      )}

      <section className="s3-panel s3-browser" aria-label="S3 file browser">
        <header className="s3-panel-header">
          <div>
            <h2>File browser</h2>
            <p>Browse files and folders in your S3 buckets.</p>
          </div>
          <label className="s3-bucket-select">
            <span>Bucket</span>
            <select
              aria-label="Select bucket"
              value={bucket}
              onChange={(event) => {
                setBucket(event.target.value);
                openPrefix("");
              }}
            >
              {buckets.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </header>

        {bucket && (
          <p className="s3-note">
            {bucket} · {currentRegion || "region unavailable"}
          </p>
        )}

        <nav className="s3-breadcrumb" aria-label="Object path">
          <button type="button" onClick={() => client.navigate("/")}>
            Buckets
          </button>
          <span>/</span>
          <button type="button" onClick={() => openPrefix("")}>
            {bucket || "Select a bucket"}
          </button>
          {parts.map((part, index) => (
            <span key={parts.slice(0, index + 1).join("/")}>
              <span> / </span>
              <button
                type="button"
                onClick={() =>
                  openPrefix(`${parts.slice(0, index + 1).join("/")}/`)
                }
              >
                {part}
              </button>
            </span>
          ))}
        </nav>

        <form
          className="s3-search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(draft.trim());
            setTokens([undefined]);
          }}
        >
          <input
            aria-label="Search files"
            placeholder="Search files by key or prefix…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
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

        <div className="s3-table-wrap" aria-busy={loading}>
          <table>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Size</th>
                <th scope="col">Last modified</th>
                <th scope="col">Storage class</th>
                <th scope="col">Download</th>
              </tr>
            </thead>
            <tbody>
              {!loading &&
                rows.map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.type === "folder" ? (
                        <button
                          className="s3-object-name"
                          type="button"
                          onClick={() => openPrefix(row.key)}
                        >
                          {row.name}/
                        </button>
                      ) : (
                        <span className="s3-object-name">{row.name}</span>
                      )}
                    </td>
                    <td>
                      <span className={`s3-file-type s3-file-type-${row.type}`}>
                        {typeLabel(row)}
                      </span>
                    </td>
                    <td>{row.size === null ? "—" : bytes(row.size)}</td>
                    <td>{date(row.lastModified)}</td>
                    <td>{row.storageClass || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="s3-download"
                        disabled={downloading === row.key}
                        onClick={() =>
                          void (row.type === "folder"
                            ? downloadFolder(row.key)
                            : download(row.key))
                        }
                      >
                        {downloading === row.key
                          ? "Preparing…"
                          : row.type === "folder"
                            ? "Download ZIP"
                            : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {loading ? (
            <p className="s3-empty">Loading files…</p>
          ) : (
            !rows.length && (
              <p className="s3-empty">
                {search
                  ? "No files match this search."
                  : "This folder is empty."}
              </p>
            )
          )}
        </div>

        <footer className="s3-pagination">
          <span>
            {page.rows.length} {page.rows.length === 1 ? "entry" : "entries"}
          </span>
          <span>Page {tokens.length}</span>
          <button
            type="button"
            disabled={loading || tokens.length === 1}
            onClick={() => setTokens((value) => value.slice(0, -1))}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={loading || !page.nextToken}
            onClick={() => setTokens((value) => [...value, page.nextToken])}
          >
            Next
          </button>
        </footer>
      </section>
    </div>
  );
}
