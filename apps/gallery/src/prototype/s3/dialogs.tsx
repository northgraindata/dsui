import { Button, Input, Modal, notify, Select } from "@northgraindata/dsui-ui";
import { useState } from "react";
import { Glyph } from "../shared/glyphs";
import { Segments } from "../shared/list";
import { Art, type ArtName } from "./art";
import { buckets, type Entry, exact, NOW, nameOf, parentOf } from "./data";
import { FileIcon } from "./filetypes";
import { addEntry, removeEntries } from "./store";

function Title({
  art,
  text,
  detail,
}: {
  art: ArtName;
  text: string;
  detail: string;
}) {
  return (
    <div className="s3-modal-title">
      <Art name={art} size={40} />
      <div>
        <strong>{text}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

export function NewFolder({
  bucket,
  prefix,
  onClose,
}: {
  bucket: string;
  prefix: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const invalid = name.includes("/");
  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="New folder"
    >
      <div className="ax-app ax-modal s3-modal">
        <Title
          art="files"
          text={`s3://${bucket}/${prefix}${name || "…"}/`}
          detail="S3 has no folders. This creates an empty object whose key ends with a slash."
        />
        <div className="ax-field">
          <span>Folder name</span>
          <Input
            aria-label="Folder name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <small className="s3-field-error">
            {invalid ? "A folder name cannot contain a slash." : ""}
          </small>
        </div>
        <footer>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!name || invalid}
            onClick={() => {
              addEntry(bucket, { key: `${prefix}${name}/` });
              notify.success(`Created ${name}/`);
              onClose();
            }}
          >
            <Glyph name="folderPlus" />
            Create folder
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

export type Transfer = "copy" | "move" | "rename";

export function MoveDialog({
  mode,
  bucket,
  prefix,
  entries,
  onClose,
}: {
  mode: Transfer;
  bucket: string;
  prefix: string;
  entries: Entry[];
  onClose: () => void;
}) {
  const one = entries.length === 1 ? entries[0] : undefined;
  const [destination, setDestination] = useState(bucket);
  const [target, setTarget] = useState(
    mode === "rename" && one ? nameOf(one.key) : prefix,
  );
  const key =
    mode === "rename" ? `${parentOf(one?.key ?? "")}${target}` : target;
  const unchanged =
    destination === bucket &&
    (mode === "rename" ? key === one?.key : target === prefix);
  const verb = mode === "copy" ? "Copy" : mode === "move" ? "Move" : "Rename";
  const subject = one ? nameOf(one.key) : `${entries.length} items`;
  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={`${verb} ${subject}`}
    >
      <div className="ax-app ax-modal s3-modal">
        <Title
          art="files"
          text={subject}
          detail={`From s3://${bucket}/${prefix}`}
        />
        {mode === "rename" ? null : (
          <div className="ax-field">
            <span>Destination bucket</span>
            <Select
              ariaLabel="Destination bucket"
              value={destination}
              onValueChange={setDestination}
              options={buckets.map((item) => ({
                value: item.name,
                label: item.name,
                icon: <Art name="buckets" size={18} />,
              }))}
            />
          </div>
        )}
        <div className="ax-field">
          <span>{mode === "rename" ? "New name" : "Destination folder"}</span>
          <Input
            aria-label={mode === "rename" ? "New name" : "Destination folder"}
            value={target}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
        {mode === "copy" ? null : (
          <p className="s3-warning">
            <Glyph name="alert" size={14} />
            S3 cannot move. DSUI copies each object, then deletes the original.
            If it stops halfway, some objects stay in both places.
          </p>
        )}
        <footer>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!target || unchanged}
            onClick={() => {
              if (mode === "rename" && one) {
                removeEntries(bucket, prefix, [one.key]);
                addEntry(bucket, { ...one, key, modified: NOW });
              } else if (mode === "move")
                removeEntries(
                  bucket,
                  prefix,
                  entries.map((entry) => entry.key),
                );
              notify.success(`${verb}: ${subject} done (prototype)`);
              onClose();
            }}
          >
            <Glyph name={mode === "copy" ? "copy" : "move"} />
            {verb}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

const lifetimes = [
  { value: "900", label: "15 minutes" },
  { value: "3600", label: "1 hour" },
  { value: "86400", label: "24 hours" },
  { value: "604800", label: "7 days" },
];

export function ShareDialog({
  bucket,
  entry,
  onClose,
}: {
  bucket: string;
  entry: Entry;
  onClose: () => void;
}) {
  const [seconds, setSeconds] = useState("3600");
  const [created, setCreated] = useState<string>();
  const until = new Date(NOW.getTime() + Number(seconds) * 1000);
  const url = `https://${bucket}.s3.eu-central-1.amazonaws.com/${encodeURI(entry.key)}?X-Amz-Expires=${created}&X-Amz-Signature=prototype`;
  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Share a temporary link"
    >
      <div className="ax-app ax-modal s3-modal">
        <div className="s3-modal-title">
          <FileIcon name={nameOf(entry.key)} size={40} />
          <div>
            <strong>{nameOf(entry.key)}</strong>
            <small>
              s3://{bucket}/{parentOf(entry.key)}
            </small>
          </div>
        </div>
        <Segments
          label="Link lifetime"
          value={seconds}
          onChange={(next) => {
            setSeconds(next);
            setCreated(undefined);
          }}
          options={lifetimes}
        />
        <p className="s3-warning">
          <Glyph name="alert" size={14} />
          Anyone who has the link can download the file until {exact(until)}. S3
          cannot revoke one link.
        </p>
        {created ? (
          <div className="s3-link">
            <code>{url}</code>
            <Button
              size="small"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                notify.success("Link copied");
              }}
            >
              <Glyph name="copy" size={13} />
              Copy
            </Button>
          </div>
        ) : null}
        <footer>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => setCreated(seconds)}>
            <Glyph name="link" />
            Create link
          </Button>
        </footer>
      </div>
    </Modal>
  );
}

const shortcuts: [keys: string[], does: string][] = [
  [["↑", "↓"], "Move through the list"],
  [["Enter"], "Open a folder or a file"],
  [["Space"], "Show or hide the preview"],
  [["X"], "Select the row (with Shift, a range)"],
  [["Backspace"], "Go up one folder"],
  [["/"], "Search this folder"],
  [["G"], "Go to a path"],
  [["Esc"], "Close the preview or clear the selection"],
  [["?"], "Show these shortcuts"],
];

export function Shortcuts({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Keyboard shortcuts"
      closeOnOutsideClick
    >
      <dl className="ax-app s3-shortcuts">
        {shortcuts.map(([keys, does]) => (
          <div key={does}>
            <dt>
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{does}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}
