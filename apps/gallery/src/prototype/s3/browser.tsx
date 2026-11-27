import { Button, ConfirmDialog, Menu, notify } from "@northgraindata/dsui-ui";
import {
  type DragEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Glyph } from "../shared/glyphs";
import { Search, useRemembered } from "../shared/list";
import { go, IconButton } from "../shared/ui";
import {
  bytes,
  type Entry,
  exact,
  listPage,
  listPrefix,
  nameOf,
  parentOf,
  stamp,
} from "./data";
import {
  MoveDialog,
  NewFolder,
  ShareDialog,
  Shortcuts,
  type Transfer,
} from "./dialogs";
import { FileIcon, fileType } from "./filetypes";
import { copyText, Inspector } from "./inspector";
import { folderPath, PathBar } from "./pathbar";
import { removeEntries, upload, useStore } from "./store";

/** ListObjectsV2 returns at most 1,000 keys; 200 keeps the table quick. */
const PAGE = 200;
type Sort = "name" | "size" | "modified";

const sorters: Record<Sort, (a: Entry, b: Entry) => number> = {
  name: (a, b) => (a.key < b.key ? -1 : 1),
  size: (a, b) => (b.size ?? -1) - (a.size ?? -1),
  modified: (a, b) =>
    (b.modified?.getTime() ?? -1) - (a.modified?.getTime() ?? -1),
};

const isFolder = (entry: Entry) => entry.key.endsWith("/");

/** Shortcuts must not steal keys from fields, menus or dialogs. */
const typingElsewhere = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      "input, textarea, [contenteditable], [role=dialog], [role=alertdialog], [role=menu], [role=listbox]",
    ),
  );

export function Browser({
  bucket,
  prefix,
  openKey,
}: {
  bucket: string;
  prefix: string;
  openKey?: string;
}) {
  useStore();
  const [filter, setFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState<Sort>("name");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [open, setOpen] = useState(openKey);
  const [tab, setTab] = useRemembered("s3:inspector-tab", "Preview");
  const [expanded, setExpanded] = useState(false);
  const [dialog, setDialog] = useState<
    | { kind: "folder" | "shortcuts" }
    | { kind: Transfer; entries: Entry[] }
    | { kind: "share" | "delete"; entries: Entry[] }
  >();
  const [dropping, setDropping] = useState(false);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const anchor = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const page = listPage(bucket, prefix, filter, offset, PAGE);
  // S3 orders by key; any other order can only rearrange the loaded page.
  const rows = [...page.entries].sort(sorters[sort]);
  const chosen = rows.filter((entry) => selected.has(entry.key));
  const opened =
    rows.find((entry) => entry.key === open) ??
    (open
      ? listPrefix(bucket, prefix).find((entry) => entry.key === open)
      : undefined);
  const paged = page.more || offset > 0;

  const reset = (change: () => void) => {
    change();
    setSelected(new Set());
    setFocus(0);
  };

  const activate = (entry: Entry) => {
    if (isFolder(entry)) go(folderPath(bucket, entry.key));
    else setOpen(entry.key);
  };

  const toggle = (index: number, range: boolean) => {
    const entry = rows[index];
    if (!entry) return;
    const next = new Set(selected);
    if (range) {
      const [from, to] = [
        Math.min(anchor.current, index),
        Math.max(anchor.current, index),
      ];
      for (const item of rows.slice(from, to + 1)) next.add(item.key);
    } else {
      anchor.current = index;
      if (next.has(entry.key)) next.delete(entry.key);
      else next.add(entry.key);
    }
    setSelected(next);
  };

  const clickRow = (event: MouseEvent, index: number) => {
    const entry = rows[index];
    if (!entry) return;
    setFocus(index);
    if (event.shiftKey || event.metaKey || event.ctrlKey)
      return toggle(index, event.shiftKey);
    activate(entry);
  };

  const move = (step: number) => {
    const next = Math.max(0, Math.min(rows.length - 1, focus + step));
    setFocus(next);
    const entry = rows[next];
    // With the preview open, the arrows walk through the files.
    if (open && entry && !isFolder(entry)) setOpen(entry.key);
    root.current
      ?.querySelector(`[data-index="${next}"]`)
      ?.scrollIntoView({ block: "nearest" });
  };

  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (typingElsewhere(event.target) || event.metaKey || event.ctrlKey)
        return;
      const entry = rows[focus];
      // A map, so key names are not mistaken for component names.
      const actions = new Map<string, () => void>([
        ["ArrowDown", () => move(1)],
        ["j", () => move(1)],
        ["ArrowUp", () => move(-1)],
        ["k", () => move(-1)],
        ["Enter", () => entry && activate(entry)],
        [
          " ",
          () =>
            entry &&
            !isFolder(entry) &&
            setOpen(open === entry.key ? undefined : entry.key),
        ],
        ["x", () => toggle(focus, event.shiftKey)],
        ["?", () => setDialog({ kind: "shortcuts" })],
        [
          "Backspace",
          () => go(prefix ? folderPath(bucket, parentOf(prefix)) : "/"),
        ],
        [
          "/",
          () =>
            root.current
              ?.querySelector<HTMLInputElement>(".s3-toolbar input")
              ?.focus(),
        ],
        [
          "g",
          () =>
            root.current
              ?.querySelector<HTMLButtonElement>(".s3-path-space")
              ?.click(),
        ],
        ["Escape", () => (open ? setOpen(undefined) : setSelected(new Set()))],
      ]);
      const action = actions.get(event.key);
      // A focused button keeps Enter and Space for itself.
      if (
        !action ||
        (event.target instanceof HTMLButtonElement &&
          (event.key === "Enter" || event.key === " "))
      )
        return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDropping(false);
    upload(bucket, prefix, [...event.dataTransfer.files]);
  };

  const rowMenu = (entry: Entry) => [
    {
      label: "Copy S3 URI",
      icon: <Glyph name="copy" />,
      onSelect: () => copyText(`s3://${bucket}/${entry.key}`, "S3 URI"),
    },
    ...(isFolder(entry)
      ? [
          {
            label: "Calculate size",
            icon: <Glyph name="sql" />,
            onSelect: () => {
              const inside = listPrefix(bucket, entry.key).filter(
                (item) => !isFolder(item),
              );
              setSizes((now) => ({
                ...now,
                [entry.key]: `${bytes(inside.reduce((sum, item) => sum + (item.size ?? 0), 0))} · ${inside.length.toLocaleString("en")} objects here`,
              }));
            },
          },
          {
            label: "Download as ZIP",
            icon: <Glyph name="download" />,
            onSelect: () => notify.success("Preparing ZIP (prototype)"),
          },
        ]
      : [
          {
            label: "Share temporary link",
            icon: <Glyph name="link" />,
            onSelect: () => setDialog({ kind: "share", entries: [entry] }),
          },
          {
            label: "Rename",
            icon: <Glyph name="edit" />,
            onSelect: () => setDialog({ kind: "rename", entries: [entry] }),
          },
        ]),
    {
      label: "Copy to…",
      icon: <Glyph name="copy" />,
      onSelect: () => setDialog({ kind: "copy", entries: [entry] }),
    },
    {
      label: "Move to…",
      icon: <Glyph name="move" />,
      onSelect: () => setDialog({ kind: "move", entries: [entry] }),
    },
    {
      label: "Delete",
      icon: <Glyph name="trash" />,
      tone: "danger" as const,
      onSelect: () => setDialog({ kind: "delete", entries: [entry] }),
    },
  ];

  const head = (key: Sort, label: string) => (
    <button
      type="button"
      aria-pressed={sort === key}
      onClick={() => setSort(key)}
    >
      {label}
      {sort === key ? " ↓" : ""}
    </button>
  );
  const deleting = dialog?.kind === "delete" ? dialog.entries : [];
  const folders = deleting.filter(isFolder).length;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target; Upload does the same by keyboard
    <div
      className="s3-browser"
      ref={root}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setDropping(false);
      }}
      onDrop={drop}
    >
      <PathBar bucket={bucket} prefix={prefix} />
      <div className="s3-toolbar">
        {chosen.length ? (
          <div className="s3-selection">
            <IconButton
              icon="close"
              label="Clear selection (Esc)"
              onClick={() => setSelected(new Set())}
            />
            <strong>{chosen.length} selected</strong>
            <small>
              {bytes(chosen.reduce((sum, entry) => sum + (entry.size ?? 0), 0))}
              {chosen.some(isFolder) ? " in files, folders not counted" : ""}
            </small>
            <span className="ax-grow" />
            <Button
              size="small"
              variant="secondary"
              onClick={() =>
                notify.success(
                  `Preparing ZIP of ${chosen.length} items (prototype)`,
                )
              }
            >
              <Glyph name="download" size={13} />
              Download ZIP
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() =>
                copyText(
                  chosen
                    .map((entry) => `s3://${bucket}/${entry.key}`)
                    .join("\n"),
                  "S3 URIs",
                )
              }
            >
              <Glyph name="copy" size={13} />
              Copy URIs
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setDialog({ kind: "copy", entries: chosen })}
            >
              Copy to…
            </Button>
            <Button
              size="small"
              variant="secondary"
              onClick={() => setDialog({ kind: "move", entries: chosen })}
            >
              <Glyph name="move" size={13} />
              Move to…
            </Button>
            <Button
              size="small"
              variant="danger"
              onClick={() => setDialog({ kind: "delete", entries: chosen })}
            >
              <Glyph name="trash" size={13} />
              Delete
            </Button>
          </div>
        ) : (
          <>
            <Search
              label="Names starting with…"
              value={filter}
              onChange={(next) =>
                reset(() => {
                  setFilter(next);
                  setOffset(0);
                })
              }
            />
            <span className="ax-grow" />
            <IconButton
              icon="keyboard"
              label="Keyboard shortcuts (?)"
              onClick={() => setDialog({ kind: "shortcuts" })}
            />
            <Button
              variant="secondary"
              onClick={() => setDialog({ kind: "folder" })}
            >
              <Glyph name="folderPlus" />
              New folder
            </Button>
            <Button onClick={() => picker.current?.click()}>
              <Glyph name="upload" />
              Upload
            </Button>
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              onChange={(event) =>
                upload(bucket, prefix, [...(event.target.files ?? [])])
              }
            />
          </>
        )}
      </div>
      <div
        className="s3-split"
        data-open={Boolean(opened)}
        data-expanded={Boolean(opened) && expanded}
      >
        <section className="s3-listing" aria-label="Objects">
          <div className="s3-row s3-head">
            <input
              type="checkbox"
              aria-label="Select all on this page"
              checked={rows.length > 0 && chosen.length === rows.length}
              ref={(box) => {
                if (box)
                  box.indeterminate =
                    chosen.length > 0 && chosen.length < rows.length;
              }}
              onChange={() =>
                setSelected(
                  chosen.length === rows.length
                    ? new Set()
                    : new Set(rows.map((entry) => entry.key)),
                )
              }
            />
            {head("name", "Name")}
            <span className="s3-col-type">Type</span>
            {head("size", "Size")}
            {head("modified", "Modified")}
            <span />
          </div>
          <div className="s3-rows" data-dsui-scroll>
            {rows.map((entry, index) => {
              const name = nameOf(entry.key);
              const folder = isFolder(entry);
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: arrows and Enter are handled for the whole list
                // biome-ignore lint/a11y/noStaticElementInteractions: the name button is the control
                <div
                  key={entry.key}
                  className="s3-row"
                  data-index={index}
                  data-focus={index === focus}
                  data-open={entry.key === open}
                  data-selected={selected.has(entry.key)}
                  onClick={(event) => clickRow(event, index)}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${name}`}
                    checked={selected.has(entry.key)}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggle(index, event.shiftKey);
                    }}
                    onChange={() => undefined}
                  />
                  <span className="s3-name">
                    <FileIcon name={folder ? entry.key : name} />
                    <button
                      type="button"
                      title={name}
                      onClick={(event) => {
                        event.stopPropagation();
                        clickRow(event, index);
                      }}
                    >
                      {folder ? name.slice(0, -1) : name}
                    </button>
                    {entry.storageClass && entry.storageClass !== "STANDARD" ? (
                      <b className="s3-storage">{entry.storageClass}</b>
                    ) : null}
                  </span>
                  <span className="s3-col-type">
                    {fileType(folder ? entry.key : name).label}
                  </span>
                  <span className="s3-size" title={sizes[entry.key]}>
                    {folder
                      ? (sizes[entry.key]?.split(" · ")[0] ?? "—")
                      : bytes(entry.size ?? 0)}
                  </span>
                  <span
                    title={entry.modified ? exact(entry.modified) : undefined}
                  >
                    {entry.modified ? stamp(entry.modified) : "—"}
                  </span>
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: only stops the row from opening */}
                  {/* biome-ignore lint/a11y/noStaticElementInteractions: only stops the row from opening */}
                  <span
                    className="s3-row-actions"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {folder ? null : (
                      <IconButton
                        icon="download"
                        label={`Download ${name}`}
                        onClick={() =>
                          notify.success(`Downloading ${name} (prototype)`)
                        }
                      />
                    )}
                    <Menu
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`More actions for ${name}`}
                        >
                          <Glyph name="more" />
                        </Button>
                      }
                      items={rowMenu(entry)}
                    />
                  </span>
                </div>
              );
            })}
            {rows.length ? null : (
              <div className="s3-empty">
                <FileIcon name="empty/" size={52} />
                <strong>
                  {filter
                    ? `No name starts with “${filter}”`
                    : "This folder is empty"}
                </strong>
                <p>
                  {filter
                    ? "S3 matches the start of the name, and capital letters matter."
                    : "Drop files here, or use Upload."}
                </p>
                {filter ? (
                  <Button variant="secondary" onClick={() => setFilter("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button onClick={() => picker.current?.click()}>
                    <Glyph name="upload" />
                    Upload files
                  </Button>
                )}
              </div>
            )}
          </div>
          <footer className="ax-pager">
            {/* S3 says whether more keys follow, never how many there are. */}
            <span>
              {paged
                ? `Items ${(offset + 1).toLocaleString("en")}–${(offset + rows.length).toLocaleString("en")}${page.more ? " · more follow" : " · last page"}`
                : `${rows.length.toLocaleString("en")} item${rows.length === 1 ? "" : "s"}`}
            </span>
            {paged && sort !== "name" ? (
              <span className="ax-warn">Sorted within this page only</span>
            ) : null}
            <span className="ax-grow" />
            {paged ? (
              <>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={!offset}
                  onClick={() => reset(() => setOffset(0))}
                >
                  First
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={!offset}
                  onClick={() =>
                    reset(() => setOffset(Math.max(0, offset - PAGE)))
                  }
                >
                  <Glyph name="left" size={13} />
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={!page.more}
                  onClick={() => reset(() => setOffset(offset + PAGE))}
                >
                  Next
                  <Glyph name="right" size={13} />
                </Button>
              </>
            ) : null}
          </footer>
        </section>
        {opened ? (
          <Inspector
            bucket={bucket}
            entry={opened}
            tab={tab}
            onTab={setTab}
            expanded={expanded}
            onExpand={() => setExpanded(!expanded)}
            onClose={() => {
              setOpen(undefined);
              setExpanded(false);
            }}
            onShare={() => setDialog({ kind: "share", entries: [opened] })}
            onMove={(kind) => setDialog({ kind, entries: [opened] })}
          />
        ) : null}
      </div>
      {dropping ? (
        <div className="s3-drop" aria-hidden="true">
          <Glyph name="upload" size={34} />
          <strong>Drop to upload</strong>
          <code>
            s3://{bucket}/{prefix}
          </code>
        </div>
      ) : null}
      {dialog?.kind === "shortcuts" ? (
        <Shortcuts onClose={() => setDialog(undefined)} />
      ) : null}
      {dialog?.kind === "folder" ? (
        <NewFolder
          bucket={bucket}
          prefix={prefix}
          onClose={() => setDialog(undefined)}
        />
      ) : null}
      {dialog?.kind === "copy" ||
      dialog?.kind === "move" ||
      dialog?.kind === "rename" ? (
        <MoveDialog
          mode={dialog.kind}
          bucket={bucket}
          prefix={prefix}
          entries={dialog.entries}
          onClose={() => setDialog(undefined)}
        />
      ) : null}
      {dialog?.kind === "share" && dialog.entries[0] ? (
        <ShareDialog
          bucket={bucket}
          entry={dialog.entries[0]}
          onClose={() => setDialog(undefined)}
        />
      ) : null}
      <ConfirmDialog
        open={dialog?.kind === "delete"}
        onOpenChange={(next) => (next ? undefined : setDialog(undefined))}
        title={
          deleting.length === 1
            ? `Delete ${nameOf(deleting[0]?.key ?? "")}?`
            : `Delete ${deleting.length} items?`
        }
        description={`${folders ? `Every object under ${folders === 1 ? "the folder" : `${folders} folders`} is deleted, including ones not listed here. ` : ""}This bucket keeps versions, so S3 adds delete markers and older versions remain.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          removeEntries(
            bucket,
            prefix,
            deleting.map((entry) => entry.key),
          );
          if (deleting.some((entry) => entry.key === open)) setOpen(undefined);
          setSelected(new Set());
          notify.success(
            `Deleted ${deleting.length} item${deleting.length === 1 ? "" : "s"}`,
          );
        }}
      />
    </div>
  );
}
