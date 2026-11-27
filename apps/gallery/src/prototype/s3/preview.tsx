import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { Search, Segments } from "../shared/list";
import {
  archiveFiles,
  code,
  csvColumns,
  csvRows,
  hexHead,
  json,
  log,
  markdown,
  notebook,
  parquetRows,
  parquetSchema,
  records,
} from "./content";
import { bytes, type Entry, nameOf } from "./data";
import { FileIcon, fileType } from "./filetypes";
import { highlight, Markdown, Source } from "./text";

const PREVIEW_LIMIT = 256 * 1024;

/** Says what is not on screen. How the file was read is not the reader's concern. */
function Note({ children }: { children: string }) {
  return <p className="s3-note">{children}</p>;
}

function Grid({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <div className="s3-grid" data-dsui-scroll>
      <table>
        <thead>
          <tr>
            <th aria-label="Row" />
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a preview never reorders
            <tr key={index}>
              <td>{index + 1}</td>
              {row.map((value, column) => (
                <td
                  key={columns[column]}
                  data-null={value === "null" || undefined}
                  title={value}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Delimited() {
  const [view, setView] = useState("table");
  return (
    <>
      <div className="s3-preview-tools">
        <Segments
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table" },
            { value: "raw", label: "Raw" },
          ]}
        />
        <Note>{`First ${csvRows.length} rows`}</Note>
      </div>
      {view === "table" ? (
        <Grid columns={csvColumns} rows={csvRows} />
      ) : (
        <Source
          name="x.txt"
          text={[csvColumns, ...csvRows].map((row) => row.join(",")).join("\n")}
        />
      )}
    </>
  );
}

function Parquet() {
  const [view, setView] = useState("rows");
  return (
    <>
      <div className="s3-preview-tools">
        <Segments
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "rows", label: "Rows" },
            { value: "schema", label: "Schema", count: parquetSchema.length },
          ]}
        />
        {view === "rows" ? (
          <Note>{`First ${parquetRows.length} rows`}</Note>
        ) : null}
      </div>
      <ul className="s3-stats">
        {[
          ["Rows", "2,418,330"],
          ["Row groups", "12"],
          ["Compression", "Snappy"],
        ].map(([label, value]) => (
          <li key={label}>
            <small>{label}</small>
            <b>{value}</b>
          </li>
        ))}
      </ul>
      {view === "rows" ? (
        <Grid
          columns={parquetSchema.map(([name]) => name)}
          rows={parquetRows}
        />
      ) : (
        <Grid
          columns={["Column", "Type", "Nullable"]}
          rows={parquetSchema.map(([name, type, nullable]) => [
            name,
            type,
            nullable ? "yes" : "no",
          ])}
        />
      )}
    </>
  );
}

function Records() {
  const [view, setView] = useState("table");
  const columns = Object.keys(records[0] ?? {});
  return (
    <>
      <div className="s3-preview-tools">
        <Segments
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "table", label: "Table" },
            { value: "raw", label: "Raw" },
          ]}
        />
        <Note>{`First ${records.length} records`}</Note>
      </div>
      {view === "table" ? (
        <Grid
          columns={columns}
          rows={records.map((record) => Object.values(record).map(String))}
        />
      ) : (
        <Source
          name="x.json"
          text={records.map((record) => JSON.stringify(record)).join("\n")}
        />
      )}
    </>
  );
}

function Log() {
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const lines = log.filter(
    (line) =>
      (level === "all" || line.includes(` ${level} `)) &&
      line.toLowerCase().includes(search.toLowerCase()),
  );
  const count = (name: string) =>
    log.filter((line) => line.includes(` ${name} `)).length;
  return (
    <>
      <div className="s3-preview-tools">
        <Segments
          label="Level"
          value={level}
          onChange={setLevel}
          options={[
            { value: "all", label: "All" },
            {
              value: "ERROR",
              label: "Errors",
              tone: "failed",
              count: count("ERROR"),
            },
            {
              value: "WARNING",
              label: "Warnings",
              tone: "up_for_retry",
              count: count("WARNING"),
            },
          ]}
        />
        <Search label="Find in preview" value={search} onChange={setSearch} />
      </div>
      <pre className="ax-log s3-fill" data-dsui-scroll>
        {lines.map((line) => (
          <span
            key={line}
            data-error={line.includes(" ERROR ")}
            data-warning={line.includes(" WARNING ")}
          >
            {line}
          </span>
        ))}
      </pre>
      <Note>{`${lines.length} of ${log.length} lines. Only the start of the file is searched.`}</Note>
    </>
  );
}

function Picture() {
  const [actual, setActual] = useState(false);
  return (
    <>
      <div className="s3-preview-tools">
        <Note>1600 × 900 pixels</Note>
        <Button
          variant="secondary"
          size="small"
          onClick={() => setActual(!actual)}
        >
          {actual ? "Fit to panel" : "Actual size"}
        </Button>
      </div>
      <div className="s3-image" data-actual={actual} data-dsui-scroll>
        <svg
          viewBox="0 0 320 180"
          role="img"
          aria-label="Revenue chart (invented preview)"
        >
          <rect width="320" height="180" fill="#fff" />
          {[38, 52, 47, 66, 71, 64, 88, 95, 90, 112, 126, 138].map(
            (value, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed series
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed series
                key={index}
                x={18 + index * 24}
                y={156 - value}
                width="16"
                height={value}
                fill="#2870ff"
              />
            ),
          )}
          <text x="18" y="20" fontSize="11" fill="#111">
            Revenue by month
          </text>
        </svg>
      </div>
    </>
  );
}

function Notice({
  name,
  title,
  text,
  action,
}: {
  name: string;
  title: string;
  text?: string;
  action?: string;
}) {
  return (
    <div className="s3-notice">
      <FileIcon name={name} size={56} />
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
      {action ? <Button variant="secondary">{action}</Button> : null}
    </div>
  );
}

const players = {
  pdf: ["PDF document", "Open PDF"],
  video: ["Video", "Play"],
  audio: ["Audio", "Play"],
} as const;

export function Preview({ entry }: { entry: Entry }) {
  const name = nameOf(entry.key);
  const type = fileType(name);
  if (entry.storageClass === "GLACIER")
    return (
      <Notice
        name={name}
        title="Archived in Glacier"
        text="S3 cannot return this object until it is restored. A restore takes minutes to hours and is billed."
      />
    );
  if (!entry.size)
    return (
      <Notice
        name={name}
        title="Empty object"
        text="This object has no content."
      />
    );
  switch (type.preview) {
    case "table":
      return <Delimited />;
    case "parquet":
      return <Parquet />;
    case "records":
      return <Records />;
    case "json":
      return (
        <>
          {entry.size > PREVIEW_LIMIT ? (
            <Note>Start of the file only</Note>
          ) : null}
          <Source name="x.json" text={json} />
        </>
      );
    case "code":
      return (
        <Source name={name} text={code[name] ?? code["pipeline.yaml"] ?? ""} />
      );
    case "text":
      return (
        <Source
          name="x.txt"
          text={
            "Partner drop arrives on the first Monday of the month.\nAsk in #data-platform before you delete anything here.\n"
          }
        />
      );
    case "log":
      return <Log />;
    case "markdown":
      return <Markdown text={markdown} />;
    case "notebook":
      return (
        <div className="s3-notebook" data-dsui-scroll>
          {notebook.map((cell) =>
            cell.type === "markdown" ? (
              <Markdown key={cell.source} text={cell.source} />
            ) : (
              <div className="s3-cell" key={cell.source}>
                <pre>{highlight(cell.source, "x.py")}</pre>
                <output>{cell.output}</output>
              </div>
            ),
          )}
        </div>
      );
    case "image":
      return <Picture />;
    case "pdf":
    case "video":
    case "audio": {
      const [title, action] = players[type.preview];
      return <Notice name={name} title={title} action={action} />;
    }
    case "archive":
      return (
        <>
          <Note>{`${archiveFiles.length} files`}</Note>
          <ul className="s3-archive">
            {archiveFiles.map(([path, size]) => (
              <li key={path}>
                <FileIcon name={path} size={22} />
                <span>{path}</span>
                <small>{bytes(size)}</small>
              </li>
            ))}
          </ul>
        </>
      );
    default:
      return (
        <>
          <p className="s3-note">
            <Glyph name="alert" size={13} /> No preview for this format. These
            are its first bytes.
          </p>
          <pre className="ax-log s3-hex" data-dsui-scroll>
            {hexHead}
          </pre>
        </>
      );
  }
}
