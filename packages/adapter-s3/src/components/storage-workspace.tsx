import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import { useCallback, useEffect, useRef, useState } from "react";
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

type FileIconName =
  | "bucket"
  | "folder"
  | "text"
  | "file"
  | "binary"
  | "image"
  | "spreadsheet"
  | "code"
  | "archive"
  | "upload"
  | "more";

const fileIconFor = (row: S3Object): FileIconName => {
  if (row.type === "folder") return "folder";
  const extension = row.name.split(".").at(-1)?.toLowerCase();
  if (
    extension &&
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"].includes(extension)
  )
    return "image";
  if (extension && ["csv", "tsv", "xls", "xlsx", "ods"].includes(extension))
    return "spreadsheet";
  if (
    extension &&
    [
      "json",
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "sql",
      "yaml",
      "yml",
      "xml",
      "html",
      "css",
      "sh",
    ].includes(extension)
  )
    return "code";
  if (extension && ["txt", "md", "log", "rst"].includes(extension))
    return "text";
  if (extension && ["zip", "tar", "gz", "bz2", "7z", "rar"].includes(extension))
    return "archive";
  if (row.contentType === "application/octet-stream" || !row.contentType)
    return "binary";
  return "file";
};

function Icon({ name }: { name: FileIconName }) {
  const paths = {
    bucket:
      "M5 6c0-3 14-3 14 0s-14 3-14 0Zm0 0v6c0 3 14 3 14 0V6m-14 6v6c0 3 14 3 14 0v-6",
    folder:
      "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
    text: "M5 3h9l5 5v13H5ZM14 3v6h5M8 13h8M8 17h6",
    file: "M5 3h9l5 5v13H5ZM14 3v6h5M9 13h6m-6 4h6",
    binary: "M5 3h9l5 5v13H5ZM14 3v6h5M8 13h2m-2 4h2m4-4h2m-2 4h2",
    image: "M5 3h9l5 5v13H5ZM14 3v6h5M7 18l3-4 2 2 2-3 3 4M8 10h.01",
    spreadsheet: "M5 3h9l5 5v13H5ZM14 3v6h5M8 12h8M8 16h8M11 10v10M15 10v10",
    code: "M5 3h9l5 5v13H5ZM14 3v6h5M9 13l-2 3 2 3m6-6 2 3-2 3",
    archive: "M5 3h9l5 5v13H5ZM14 3v6h5M8 3v4h8M9 13h6m-6 4h6",
    upload: "M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4",
    more: "M5 12h.01M12 12h.01M19 12h.01",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StorageWorkspace({ client, node }: ComponentProps) {
  const props = node.kind === "custom" ? node.props.props : undefined;
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const bucket = String(props?.bucket ?? "");
  const [prefix, setPrefix] = useState(String(props?.prefix ?? ""));
  const [page, setPage] = useState<ObjectPage>({ rows: [] });
  const [tokens, setTokens] = useState<(string | undefined)[]>([undefined]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string>();
  const [menu, setMenu] = useState<{
    row: S3Object;
    left: number;
    top: number;
  }>();
  const [revision, refresh] = useState(0);
  const root = !bucket;

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
          prefix,
          search: Boolean(search),
          token,
        },
      })
      .then((value) => {
        if (!active) return;
        const result = value as ObjectPage;
        const query = search.toLocaleLowerCase();
        setPage(
          query
            ? {
                ...result,
                rows: result.rows.filter((row) =>
                  row.key.toLocaleLowerCase().includes(query),
                ),
              }
            : result,
        );
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

  useEffect(() => {
    const reload = (event: Event) => {
      const detail = (event as CustomEvent<{ bucket?: string }>).detail;
      if (detail?.bucket === bucket) refresh((value) => value + 1);
    };
    window.addEventListener("s3-object-change", reload);
    return () => window.removeEventListener("s3-object-change", reload);
  }, [bucket]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent | KeyboardEvent) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === "Escape"
          : !(event.target as Element | null)?.closest(".s3-row-menu")
      )
        setMenu(undefined);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, []);

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

      {root ? (
        <section className="s3-buckets" aria-label="S3 buckets">
          {buckets.map((item) => (
            <button
              className="s3-bucket-card"
              key={item.name}
              type="button"
              onClick={() =>
                client.navigate(`/buckets/${encodeURIComponent(item.name)}`)
              }
            >
              <span className="s3-bucket-icon">
                <Icon name="bucket" />
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.region} · created {date(item.createdAt)}
                </small>
              </span>
            </button>
          ))}
          {!buckets.length && <p className="s3-empty">No buckets found.</p>}
        </section>
      ) : (
        <section className="s3-browser" aria-label={`Objects in ${bucket}`}>
          <header className="s3-browser-header">
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
            <S3HeaderActions client={client} bucket={bucket} prefix={prefix} />
          </header>
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

          <div className="s3-table-wrap" aria-busy={loading}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Size</th>
                  <th scope="col">Last modified</th>
                  <th scope="col">Actions</th>
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
                            <Icon name={fileIconFor(row)} />
                            {row.name}/
                          </button>
                        ) : (
                          <span className="s3-object-name">
                            <Icon name={fileIconFor(row)} />
                            {row.name}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`s3-file-type s3-file-type-${row.type}`}
                        >
                          {typeLabel(row)}
                        </span>
                      </td>
                      <td>{row.size === null ? "—" : bytes(row.size)}</td>
                      <td>{date(row.lastModified)}</td>
                      <td>
                        <button
                          className="s3-row-menu-trigger"
                          type="button"
                          aria-label={`Actions for ${row.name}`}
                          aria-expanded={menu?.row.key === row.key}
                          onClick={(event) => {
                            const bounds =
                              event.currentTarget.getBoundingClientRect();
                            setMenu({
                              row,
                              left: Math.min(
                                Math.max(8, bounds.right - 130),
                                window.innerWidth - 138,
                              ),
                              top: bounds.bottom + 4,
                            });
                          }}
                        >
                          <Icon name="more" />
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
          {menu ? (
            <div
              className="s3-row-menu"
              style={{ left: menu.left, top: menu.top }}
            >
              <button
                type="button"
                disabled={downloading === menu.row.key}
                onClick={() => {
                  setMenu(undefined);
                  void (menu.row.type === "folder"
                    ? downloadFolder(menu.row.key)
                    : download(menu.row.key));
                }}
              >
                {downloading === menu.row.key
                  ? "Preparing…"
                  : menu.row.type === "folder"
                    ? "Download ZIP"
                    : "Download"}
              </button>
            </div>
          ) : null}

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
      )}
    </div>
  );
}

function S3HeaderActions({
  client,
  bucket,
  prefix,
}: {
  client: ComponentProps["client"];
  bucket: string;
  prefix: string;
}) {
  const uploadInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const changed = () =>
    window.dispatchEvent(
      new CustomEvent("s3-object-change", { detail: { bucket } }),
    );
  const upload = async (file: File) => {
    try {
      const base64 = await fileBase64(file);
      const result = await client.executeAction({
        actionId: "s3-upload",
        input: {
          bucket,
          key: `${prefix}${file.name}`,
          base64,
          contentType: file.type || "application/octet-stream",
        },
      });
      if (result.status !== "success")
        throw new Error(result.message || "Upload failed");
      changed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    }
  };
  const createFolder = async () => {
    const name = window.prompt("Folder name");
    if (!name?.trim()) return;
    try {
      const result = await client.executeAction({
        actionId: "s3-create-folder",
        input: { bucket, key: `${prefix}${name.trim()}/` },
      });
      if (result.status !== "success")
        throw new Error(result.message || "Could not create folder");
      changed();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create folder",
      );
    }
  };
  return (
    <div className="s3-header-actions">
      <input
        ref={uploadInput}
        className="s3-file-input"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
      <button
        className="s3-primary"
        type="button"
        onClick={() => uploadInput.current?.click()}
      >
        <Icon name="upload" /> Upload
      </button>
      <button type="button" onClick={() => void createFolder()}>
        <Icon name="folder" /> Create folder
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read file"));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}
