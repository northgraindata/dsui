/** The open file, beside the list, so the arrow keys walk through previews. */
import { Button, notify } from "@northgraindata/dsui-ui";
import { Glyph } from "../shared/glyphs";
import { IconButton, Tabs } from "../shared/ui";
import { bytes, type Entry, exact, NOW, nameOf, stamp } from "./data";
import { FileIcon, fileType } from "./filetypes";
import { Preview } from "./preview";

export const copyText = (text: string, what: string) => {
  void navigator.clipboard?.writeText(text);
  notify.success(`${what} copied`, { description: text });
};

function Fact({
  label,
  value,
  copy,
}: {
  label: string;
  value: string;
  copy?: boolean;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <span>{value}</span>
        {copy ? (
          <IconButton
            icon="copy"
            label={`Copy ${label}`}
            onClick={() => copyText(value, label)}
          />
        ) : null}
      </dd>
    </>
  );
}

function Details({ bucket, entry }: { bucket: string; entry: Entry }) {
  const type = fileType(nameOf(entry.key));
  return (
    <div className="s3-details" data-dsui-scroll>
      <dl>
        <Fact label="S3 URI" value={`s3://${bucket}/${entry.key}`} copy />
        <Fact label="ARN" value={`arn:aws:s3:::${bucket}/${entry.key}`} copy />
        <Fact
          label="Size"
          value={`${bytes(entry.size ?? 0)} (${(entry.size ?? 0).toLocaleString("en")} bytes)`}
        />
        <Fact label="Last modified" value={exact(entry.modified ?? NOW)} />
        <Fact label="Type" value={type.label} />
        <Fact label="Content type" value="application/octet-stream" />
        <Fact label="Storage class" value={entry.storageClass ?? "STANDARD"} />
        <Fact label="Encryption" value="AES256 (SSE-S3)" />
        <Fact label="ETag" value="9b2cf535f27731c974343645a3985328-12" copy />
      </dl>
      <h3>Metadata</h3>
      <dl>
        <Fact label="x-amz-meta-source" value="airflow" />
        <Fact label="x-amz-meta-run-id" value="scheduled__2026-11-27T05:00" />
      </dl>
      <h3>Tags</h3>
      <p className="ax-tags">
        <span className="ax-chip-tag">team: analytics</span>
        <span className="ax-chip-tag">retention: 90d</span>
      </p>
    </div>
  );
}

function Versions({ entry }: { entry: Entry }) {
  const versions = [
    {
      id: "3sL4kqtJlcpXroDTDmJrmSpXd3QIpTh9",
      minutes: 0,
      size: entry.size ?? 0,
      deleted: false,
    },
    {
      id: "QUpfdndhfDuLmJtmZXkQ1xCSa7GTpFmx",
      minutes: 1440,
      size: Math.round((entry.size ?? 0) * 0.97),
      deleted: false,
    },
    { id: "null", minutes: 4320, size: 0, deleted: true },
    {
      id: "L4kqtJlcpXroDTVmJrmSpXd3QIpFgjde",
      minutes: 10_080,
      size: Math.round((entry.size ?? 0) * 0.82),
      deleted: false,
    },
  ];
  return (
    <ul className="s3-versions">
      {versions.map((version, index) => {
        const when = new Date(
          (entry.modified ?? NOW).getTime() - version.minutes * 60_000,
        );
        return (
          <li key={version.id} data-deleted={version.deleted}>
            <div>
              <strong>{stamp(when)}</strong>
              {index === 0 ? <b>Current</b> : null}
              {version.deleted ? <b data-tone="danger">Delete marker</b> : null}
              <code>{version.id}</code>
            </div>
            <small>{version.deleted ? "" : bytes(version.size)}</small>
            {version.deleted ? (
              <span />
            ) : (
              <IconButton icon="download" label="Download this version" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Inspector({
  bucket,
  entry,
  tab,
  expanded,
  onTab,
  onExpand,
  onClose,
  onShare,
  onMove,
}: {
  bucket: string;
  entry: Entry;
  tab: string;
  expanded: boolean;
  onTab: (tab: string) => void;
  onExpand: () => void;
  onClose: () => void;
  onShare: () => void;
  onMove: (mode: "copy" | "move" | "rename") => void;
}) {
  const name = nameOf(entry.key);
  const archived = entry.storageClass === "GLACIER";
  return (
    <aside className="s3-inspector" aria-label={`File ${name}`}>
      <header>
        <FileIcon name={name} size={36} />
        <div>
          <strong title={name}>{name}</strong>
          <small>
            {fileType(name).label} · {bytes(entry.size ?? 0)} ·{" "}
            {stamp(entry.modified ?? NOW)}
          </small>
        </div>
        <IconButton
          icon="expand"
          label={expanded ? "Show the list again" : "Widen preview"}
          onClick={onExpand}
        />
        <IconButton icon="close" label="Close preview" onClick={onClose} />
      </header>
      <div className="s3-inspector-actions">
        <Button
          size="small"
          disabled={archived}
          onClick={() => notify.success(`Downloading ${name} (prototype)`)}
        >
          <Glyph name="download" size={13} />
          Download
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={archived}
          onClick={onShare}
        >
          <Glyph name="link" size={13} />
          Share
        </Button>
        <Button
          size="small"
          variant="secondary"
          onClick={() => copyText(`s3://${bucket}/${entry.key}`, "S3 URI")}
        >
          <Glyph name="copy" size={13} />
          Copy URI
        </Button>
        <span className="ax-grow" />
        <IconButton
          icon="edit"
          label="Rename"
          onClick={() => onMove("rename")}
        />
        <IconButton icon="move" label="Move" onClick={() => onMove("move")} />
      </div>
      <Tabs
        tabs={["Preview", "Details", "Versions"]}
        value={tab}
        onChange={onTab}
      />
      <div className="s3-inspector-body">
        {tab === "Preview" ? (
          <Preview key={entry.key} entry={entry} />
        ) : tab === "Details" ? (
          <Details bucket={bucket} entry={entry} />
        ) : (
          <Versions entry={entry} />
        )}
      </div>
    </aside>
  );
}
