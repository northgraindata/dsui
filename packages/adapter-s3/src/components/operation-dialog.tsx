import type { ComponentClient } from "@northgraindata/dsui-adapter-sdk";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { S3Bucket } from "../context";
import type { Operation } from "./storage-workspace";

export function OperationDialog({
  client,
  operation,
  bucket,
  prefix,
  keys,
  buckets,
  close,
  done,
}: {
  client: ComponentClient;
  operation: Operation;
  bucket: string;
  prefix: string;
  keys: string[];
  buckets: S3Bucket[];
  close(): void;
  done(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState(bucket);
  const [key, setKey] = useState(
    operation === "Copy" || operation === "Move" ? keys[0] : prefix,
  );
  const [file, setFile] = useState<File>();
  const [expiry, setExpiry] = useState(900);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      let actionId = "";
      let input: Record<string, unknown> = { bucket, key: keys[0] };
      if (operation === "Upload") {
        if (!file) throw new Error("Choose a file.");
        if (file.size > 5 * 1024 ** 2)
          throw new Error("Uploads are limited to 5 MiB.");
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error("Could not read file"));
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.readAsDataURL(file);
        });
        input = {
          bucket,
          key: `${key}${key && !key.endsWith("/") ? "/" : ""}${file.name}`,
          base64,
          contentType: file.type || "application/octet-stream",
        };
        actionId = "s3-upload";
      } else if (operation === "Create folder") {
        actionId = "s3-create-folder";
        input = { bucket, key };
      } else if (operation === "Delete") {
        actionId = "s3-delete-objects";
        input = { bucket, keys, prefix };
      } else if (operation === "Copy" || operation === "Move") {
        actionId = "s3-copy";
        input = {
          ...input,
          destinationBucket: destination,
          destinationKey: key,
          move: operation === "Move",
        };
      } else {
        actionId = "s3-presign-get";
        input = { ...input, expiresIn: expiry };
      }
      const result = await client.executeAction({ actionId, input });
      if (result.status !== "success")
        throw new Error(result.message ?? "Operation failed");
      if (operation === "Presigned URL" || operation === "Download") {
        if (
          !result.data ||
          typeof result.data !== "object" ||
          !("url" in result.data) ||
          typeof result.data.url !== "string"
        )
          throw new Error("Invalid download response");
        setUrl(result.data.url);
      } else done();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="s3-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <form onSubmit={submit}>
        <header>
          <h2>{operation}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            disabled={busy}
            onClick={close}
          >
            ×
          </button>
        </header>
        <p>
          {bucket}
          {keys.length
            ? ` · ${keys.length} selected object${keys.length === 1 ? "" : "s"}`
            : ""}
        </p>
        {operation === "Delete" && (
          <>
            <p>
              Delete the selected objects? Versioned buckets retain older
              versions; unversioned deletions cannot be undone.
            </p>
            <ul>
              {keys.map((value) => (
                <li key={value}>{value}</li>
              ))}
            </ul>
          </>
        )}
        {(operation === "Copy" || operation === "Move") && (
          <>
            <label>
              Destination bucket
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {buckets.map((b) => (
                  <option key={b.name}>{b.name}</option>
                ))}
              </select>
            </label>
            <p>
              Any object at the destination key will be replaced. Copy is
              limited to 5 GiB; move deletes the source after copying.
            </p>
          </>
        )}
        {["Upload", "Create folder", "Copy", "Move"].includes(operation) && (
          <label>
            {operation === "Upload" ? "Destination prefix" : "Destination key"}
            <input
              required={operation !== "Upload"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
        )}
        {operation === "Upload" && (
          <label>
            File (up to 5 MiB)
            <input
              type="file"
              required
              onChange={(e) => setFile(e.target.files?.[0])}
            />
            <small>Existing keys are not overwritten.</small>
          </label>
        )}
        {(operation === "Presigned URL" || operation === "Download") && (
          <label>
            Expires in (seconds)
            <input
              type="number"
              min="60"
              max="604800"
              value={expiry}
              onChange={(e) => setExpiry(Number(e.target.value))}
            />
          </label>
        )}
        {url && (
          <div className="s3-link-result">
            <label>
              Temporary URL
              <textarea readOnly value={url} />
            </label>
            <a href={url} target="_blank" rel="noreferrer">
              Open download ↗
            </a>
            <button
              type="button"
              onClick={() =>
                navigator.clipboard
                  .writeText(url)
                  .catch(() => setError("Select and copy the URL manually."))
              }
            >
              Copy URL
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="s3-error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="s3-primary" type="submit" disabled={busy}>
            {busy
              ? "Working…"
              : operation === "Download"
                ? "Generate download link"
                : operation}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
