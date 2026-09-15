import type { ComponentClient } from "@northgraindata/dsui-adapter-sdk";
import { useEffect, useState } from "react";
import type { ObjectVersion, Preview, S3ObjectDetails } from "../context";
import { bytes, date } from "./storage-workspace";
export function ObjectInspector({
  client,
  bucket,
  objectKey,
  details,
}: {
  client: ComponentClient;
  bucket: string;
  objectKey?: string;
  details?: S3ObjectDetails;
}) {
  const [preview, setPreview] = useState<Preview>();
  const [versions, setVersions] = useState<ObjectVersion[]>([]);
  const [markers, setMarkers] = useState<{
    keyMarker?: string;
    versionMarker?: string;
  }>({});
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Preview");
  useEffect(() => {
    setPreview(undefined);
    setVersions([]);
    setMarkers({});
    setError("");
    if (!objectKey) return;
    let active = true;
    client
      .executeResource({
        resourceId: "s3-preview",
        input: { bucket, key: objectKey },
      })
      .then((value) => {
        if (active) setPreview(value as Preview);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    client
      .executeResource({
        resourceId: "s3-versions",
        input: { bucket, key: objectKey },
      })
      .then((value) => {
        if (!active) return;
        const data = value as {
          rows: ObjectVersion[];
          keyMarker?: string;
          versionMarker?: string;
        };
        setVersions(data.rows);
        setMarkers({
          keyMarker: data.keyMarker,
          versionMarker: data.versionMarker,
        });
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [client, bucket, objectKey]);
  const more = async () => {
    try {
      const data = (await client.executeResource({
        resourceId: "s3-versions",
        input: { bucket, key: objectKey, ...markers },
      })) as {
        rows: ObjectVersion[];
        keyMarker?: string;
        versionMarker?: string;
      };
      setVersions((v) => [...v, ...data.rows]);
      setMarkers({
        keyMarker: data.keyMarker,
        versionMarker: data.versionMarker,
      });
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <section className="s3-panel s3-inspector">
      <h2>Object details</h2>
      {!objectKey ? (
        <div className="s3-empty">
          Select an object to see its metadata, preview and versions.
        </div>
      ) : (
        <>
          <h3 className="s3-key">{objectKey.split("/").at(-1)}</h3>
          <p className="s3-path">
            s3://{bucket}/{objectKey}
          </p>
          {details ? (
            <dl>
              {[
                ["Object key", details.key],
                ["Size", bytes(details.size ?? 0)],
                ["Last modified", date(details.lastModified)],
                ["Content type", details.contentType],
                ["Storage class", details.storageClass],
                ["ETag", details.eTag],
                ["Encryption", details.encryption ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div>
                <dt>Tags</dt>
                <dd>
                  {Object.entries(details.tags).length
                    ? Object.entries(details.tags).map(([k, v]) => (
                        <span className="s3-badge" key={k}>
                          {k}={v}
                        </span>
                      ))
                    : "None"}
                </dd>
              </div>
              <div>
                <dt>Metadata</dt>
                <dd>
                  {Object.entries(details.metadata)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ") || "None"}
                </dd>
              </div>
            </dl>
          ) : (
            <p>Loading metadata…</p>
          )}
          <div className="s3-inspector-tabs">
            {["Preview", "Versions"].map((label) => (
              <button
                type="button"
                aria-pressed={tab === label}
                key={label}
                onClick={() => setTab(label)}
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="s3-error">
              {error}
            </p>
          )}
          {tab === "Preview" ? (
            preview ? (
              preview.kind === "image" ? (
                <img src={preview.content} alt={`Preview of ${objectKey}`} />
              ) : isCsv(objectKey) && preview.kind === "text" ? (
                <CsvPreview content={preview.content} />
              ) : (
                <pre>{formatTextPreview(objectKey, preview.content)}</pre>
              )
            ) : (
              <p>Loading preview…</p>
            )
          ) : (
            <>
              <ul className="s3-activity">
                {versions.map((v) => (
                  <li key={`${v.id}:${v.deleted}`}>
                    <strong>
                      {v.deleted ? "Delete marker" : bytes(v.size)}{" "}
                      {v.latest ? "· Current" : ""}
                    </strong>
                    <span>{date(v.modified)}</span>
                    <code>{v.id}</code>
                  </li>
                ))}
              </ul>
              {!versions.length && <p>No versions returned.</p>}
              {markers.keyMarker && (
                <button type="button" onClick={() => void more()}>
                  More versions
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function isCsv(key: string) {
  return key.toLowerCase().endsWith(".csv");
}

function formatTextPreview(key: string, content: string) {
  if (!key.toLowerCase().endsWith(".json")) return content;
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    if (char === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index++;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && content[index + 1] === "\n") index++;
      row.push(field);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows.slice(0, 101);
}

function CsvPreview({ content }: { content: string }) {
  const [header = [], ...rows] = parseCsv(content);
  const occurrence = (values: string[], value: string, index: number) =>
    values.slice(0, index).filter((prior) => prior === value).length;
  return (
    <div className="s3-csv-wrap">
      <table className="s3-csv-table">
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={`${cell}:${occurrence(header, cell, index)}`}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 12).map((row, rowIndex) => (
            <tr
              key={`${row.join("\u001f")}:${rows.slice(0, rowIndex).filter((prior) => prior.join("\u001f") === row.join("\u001f")).length}`}
            >
              {header.map((column, columnIndex) => (
                <td
                  key={`${column}:${occurrence(header, column, columnIndex)}`}
                >
                  {row[columnIndex] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="s3-note">CSV file has a header but no rows.</p>
      )}
    </div>
  );
}
