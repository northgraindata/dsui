import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import {
  Choice,
  Empty,
  Search,
  Segments,
  Toolbar,
  unique,
  usePages,
  useRemembered,
} from "../shared/list";
import { Act, go, Header, IconButton, Panel } from "../shared/ui";
import { Art } from "./art";
import {
  buckets,
  changes,
  exact,
  incompleteUploads,
  nameOf,
  parentOf,
  stamp,
} from "./data";
import { FileIcon } from "./filetypes";
import { copyText } from "./inspector";
import { folderPath } from "./pathbar";
import { Source } from "./text";

const art = (name: Parameters<typeof Art>[0]["name"]) => (
  <Art name={name} size={52} />
);

export function Buckets() {
  const [filters, setFilters] = useRemembered("s3:buckets", {
    search: "",
    region: "",
  });
  const rows = buckets
    .filter(
      (item) =>
        item.name.includes(filters.search.toLowerCase()) &&
        (!filters.region || item.region === filters.region),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const { visible, pager } = usePages(
    "s3:buckets",
    rows,
    JSON.stringify(filters),
  );
  return (
    <>
      <Header art={art("buckets")} title="Buckets" />
      <Toolbar>
        <Search
          label="Find a bucket"
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
        />
        <Choice
          all="All regions"
          value={filters.region}
          options={unique(buckets.map((item) => item.region))}
          onChange={(region) => setFilters({ ...filters, region })}
        />
      </Toolbar>
      <Panel flush>
        <div className="ax-table s3-bucket-table" data-dsui-scroll>
          <div className="ax-thead">
            <span>Bucket</span>
            <span>Region</span>
            <span>Created</span>
            <span />
          </div>
          {visible.map((item) => (
            // biome-ignore lint/a11y/useSemanticElements: the row holds buttons
            <div
              className="ax-tr"
              role="link"
              tabIndex={0}
              key={item.name}
              onClick={() => go(folderPath(item.name, ""))}
              onKeyDown={(event) =>
                event.key === "Enter" && go(folderPath(item.name, ""))
              }
            >
              <span className="s3-name">
                <Art name="buckets" size={30} />
                <strong>{item.name}</strong>
              </span>
              <code>{item.region}</code>
              <span title={exact(item.created)}>{stamp(item.created)}</span>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops the row from opening */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row from opening */}
              <span
                className="ax-row-actions"
                onClick={(event) => event.stopPropagation()}
              >
                <IconButton
                  icon="copy"
                  label="Copy ARN"
                  onClick={() => copyText(`arn:aws:s3:::${item.name}`, "ARN")}
                />
                <IconButton
                  icon="settings"
                  label={`Settings of ${item.name}`}
                  onClick={() => go(`/buckets/${item.name}/settings`)}
                />
              </span>
            </div>
          ))}
        </div>
        {rows.length ? null : (
          <Empty
            filtered
            onClear={() => setFilters({ search: "", region: "" })}
          />
        )}
        {pager}
      </Panel>
    </>
  );
}

const policy = (bucket: string) =>
  JSON.stringify(
    {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "DenyInsecureTransport",
          Effect: "Deny",
          Principal: "*",
          Action: "s3:*",
          Resource: [`arn:aws:s3:::${bucket}`, `arn:aws:s3:::${bucket}/*`],
          Condition: { Bool: { "aws:SecureTransport": "false" } },
        },
      ],
    },
    null,
    2,
  );

/** Multipart uploads that never finished belong to their bucket. */
function IncompleteUploads({ bucket }: { bucket: string }) {
  const rows = incompleteUploads.filter((item) => item.bucket === bucket);
  const { visible, pager } = usePages(`s3:uploads:${bucket}`, rows, bucket);
  return (
    <Panel
      title="Incomplete uploads"
      aside={
        rows.length ? (
          <small className="s3-aside">
            {rows.length} unfinished. Their parts are stored and billed until
            aborted.
          </small>
        ) : null
      }
      flush
    >
      {rows.length ? (
        <>
          <div className="ax-table s3-upload-table" data-dsui-scroll>
            <div className="ax-thead">
              <span>Key</span>
              <span>Started</span>
              <span>Parts</span>
              <span />
            </div>
            {visible.map((item) => (
              <div className="ax-tr ax-tr-static" key={item.id}>
                <span className="s3-name">
                  <FileIcon name={nameOf(item.key)} size={24} />
                  <strong title={item.key}>{item.key}</strong>
                </span>
                <span title={exact(item.started)}>{stamp(item.started)}</span>
                <span>{item.parts}</span>
                <Act
                  iconOnly
                  icon="trash"
                  label="Abort"
                  title={`Abort the upload of ${nameOf(item.key)}?`}
                  description="S3 deletes the parts uploaded so far. The upload cannot be resumed."
                />
              </div>
            ))}
          </div>
          {pager}
        </>
      ) : (
        <p className="ax-empty">No incomplete uploads in this bucket.</p>
      )}
    </Panel>
  );
}

export function Settings({ bucket }: { bucket: string }) {
  const info = buckets.find((item) => item.name === bucket);
  return (
    <>
      <Header
        art={art("settings")}
        title={bucket}
        crumbs={[["Buckets", "/"]]}
        meta={<span className="ax-chip">{info?.region}</span>}
      />
      <div className="s3-facts">
        <article>
          <small>Versioning</small>
          <strong>
            <i className="ax-dot" data-state="success" />
            Enabled
          </strong>
          <p>Deletes add a marker; older versions stay and are billed.</p>
        </article>
        <article>
          <small>Default encryption</small>
          <strong>
            <i className="ax-dot" data-state="success" />
            SSE-S3 (AES256)
          </strong>
          <p>Applies to objects uploaded from now on.</p>
        </article>
      </div>
      <IncompleteUploads bucket={bucket} />
      <Panel
        title="Bucket policy"
        aside={
          <Button
            size="small"
            variant="secondary"
            onClick={() => copyText(policy(bucket), "Policy")}
          >
            <Glyph name="copy" size={13} />
            Copy
          </Button>
        }
      >
        <Source name="policy.json" text={policy(bucket)} />
      </Panel>
    </>
  );
}

const operationState: Record<string, string> = {
  Delete: "failed",
  Upload: "success",
  "Share link": "up_for_retry",
};

export function Activity() {
  const [filters, setFilters] = useRemembered("s3:activity", {
    search: "",
    operation: "all",
  });
  const matching = changes.filter((item) =>
    item.key.toLowerCase().includes(filters.search.toLowerCase()),
  );
  const rows = matching.filter(
    (item) =>
      filters.operation === "all" || item.operation === filters.operation,
  );
  const { visible, pager } = usePages(
    "s3:activity",
    rows,
    JSON.stringify(filters),
  );
  return (
    <>
      <Header art={art("activity")} title="Changes made in DSUI" />
      <Toolbar>
        <Segments
          label="Operation"
          value={filters.operation}
          onChange={(operation) => setFilters({ ...filters, operation })}
          options={[
            { value: "all", label: "All", count: matching.length },
            ...[
              "Upload",
              "Copy",
              "Move",
              "Delete",
              "Create folder",
              "Share link",
            ].map((name) => ({
              value: name,
              label: name,
              count: matching.filter((item) => item.operation === name).length,
            })),
          ]}
        />
        <span className="ax-grow" />
        <Search
          label="Search by key"
          value={filters.search}
          onChange={(search) => setFilters({ ...filters, search })}
        />
      </Toolbar>
      <p className="s3-warning">
        <Glyph name="alert" size={14} />
        This is what DSUI did. Changes made by other tools are not here; use
        CloudTrail for a full audit.
      </p>
      <Panel flush>
        <div className="ax-table s3-activity-table" data-dsui-scroll>
          <div className="ax-thead">
            <span>When</span>
            <span>Operation</span>
            <span>Object</span>
          </div>
          {visible.map((item) => (
            <button
              type="button"
              className="ax-tr"
              key={item.id}
              onClick={() => go(folderPath(item.bucket, parentOf(item.key)))}
            >
              <span title={exact(item.at)}>{stamp(item.at)}</span>
              <span>
                <i
                  className="ax-dot"
                  data-state={operationState[item.operation] ?? "running"}
                />{" "}
                {item.operation}
              </span>
              <span className="s3-name">
                <FileIcon name={nameOf(item.key)} size={22} />
                <strong title={item.key}>
                  s3://{item.bucket}/{item.key}
                </strong>
              </span>
            </button>
          ))}
        </div>
        {rows.length ? (
          pager
        ) : (
          <Empty
            filtered
            onClear={() => setFilters({ search: "", operation: "all" })}
          />
        )}
      </Panel>
    </>
  );
}
