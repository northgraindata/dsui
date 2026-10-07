import {
  type Attachment,
  attachmentAccept,
  attachmentType,
  type DraftAttachment,
  fileSize,
  isTextAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MAX_TEXT_BYTES,
} from "./attachments";
import { React } from "./react";

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onabort = () => reject(new Error("File reading cancelled"));
    reader.onload = () => {
      if (typeof reader.result !== "string")
        reject(new Error(`Could not read ${file.name}`));
      else resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

async function prepareFile(file: File): Promise<DraftAttachment> {
  const mediaType = attachmentType(file.name, file.type);
  if (!mediaType)
    throw new Error(
      `Unsupported file: ${file.name}. Use images, PDFs, text or code files.`,
    );
  const limit = isTextAttachment(mediaType) ? MAX_TEXT_BYTES : MAX_FILE_BYTES;
  if (!file.size || file.size > limit)
    throw new Error(
      `${file.name}: file must be between 1 byte and ${fileSize(limit)}.`,
    );
  if (file.name.length > 255)
    throw new Error("File names must be at most 255 characters.");
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mediaType,
    size: file.size,
    data: await readFile(file),
  };
}

function validateBatch(
  existing: readonly DraftAttachment[],
  incoming: readonly File[],
) {
  if (existing.length + incoming.length > MAX_ATTACHMENTS)
    throw new Error("Attach up to 5 files per message.");
  if (
    [...existing, ...incoming].reduce((size, file) => size + file.size, 0) >
    MAX_ATTACHMENT_BYTES
  )
    throw new Error("Attachments must total 10 MB or less.");
}

export function clipboardFiles(data: DataTransfer): File[] {
  const files = Array.from(data.files);
  return files.length
    ? files
    : Array.from(data.items)
        .filter((item) => item.kind === "file")
        .flatMap((item) => {
          const file = item.getAsFile();
          return file ? [file] : [];
        });
}

export function useAttachmentDraft(onError: (message: string) => void) {
  const { useState, useRef, useEffect } = React;
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [reading, setReading] = useState(false);
  const files = useRef(attachments);
  const busy = useRef(false);
  const generation = useRef(0);
  files.current = attachments;
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const clear = () => {
    generation.current += 1;
    files.current = [];
    busy.current = false;
    setReading(false);
    setAttachments([]);
  };
  const addFiles = async (incoming: readonly File[]) => {
    if (!incoming.length) return;
    if (busy.current) {
      onError("Wait for the current attachments to finish loading.");
      return;
    }
    const version = generation.current;
    busy.current = true;
    setReading(true);
    try {
      validateBatch(files.current, incoming);
      const next: DraftAttachment[] = [];
      for (const file of incoming) next.push(await prepareFile(file));
      if (version !== generation.current) return;
      files.current = [...files.current, ...next];
      setAttachments(files.current);
    } catch (cause) {
      if (version === generation.current)
        onError(
          cause instanceof Error ? cause.message : "Could not attach files",
        );
    } finally {
      if (version === generation.current) {
        busy.current = false;
        setReading(false);
      }
    }
  };
  const remove = (id: string) => {
    files.current = files.current.filter((attachment) => attachment.id !== id);
    setAttachments(files.current);
  };
  return { attachments, reading, addFiles, remove, clear };
}

export function AttachmentPicker({
  disabled,
  onFiles,
}: {
  disabled: boolean;
  onFiles(files: File[]): void;
}) {
  return (
    <label
      className="da-attachment-picker"
      title="Attach images, PDFs, text or code files"
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="m21 11-8.5 8.5a6 6 0 0 1-8.5-8.5L13 2.5a4 4 0 0 1 5.7 5.7l-8.5 8.5a2 2 0 0 1-2.8-2.8L15 6.3" />
      </svg>
      <input
        type="file"
        aria-label="Attach files or photos"
        accept={attachmentAccept}
        multiple
        disabled={disabled}
        onChange={(event) => {
          onFiles(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
    </label>
  );
}

export function DraftAttachments({
  attachments,
  disabled,
  remove,
}: {
  attachments: readonly DraftAttachment[];
  disabled: boolean;
  remove(id: string): void;
}) {
  return (
    <section className="da-attachments" aria-label="Attachments to send">
      {attachments.map((file) => (
        <div className="da-attachment" key={file.id}>
          {file.mediaType.startsWith("image/") && (
            <img
              src={`data:${file.mediaType};base64,${file.data}`}
              alt={file.name}
            />
          )}
          <span>
            <strong title={file.name}>{file.name}</strong>
            <small>{fileSize(file.size)}</small>
          </span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => remove(file.id)}
          >
            ×
          </button>
        </div>
      ))}
    </section>
  );
}

const blobFromData = (data: string, mediaType: string) =>
  new Blob(
    [Uint8Array.from(atob(data), (character) => character.charCodeAt(0))],
    { type: mediaType },
  );

export function MessageAttachment({
  attachment,
  conversationId,
  load,
}: {
  attachment: Attachment;
  conversationId: string;
  load(conversationId: string, attachmentId: string): Promise<string>;
}) {
  const { useState, useEffect } = React;
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const isImage = attachment.mediaType.startsWith("image/");
  useEffect(() => {
    if (!isImage) return;
    let active = true;
    let url: string | undefined;
    void load(conversationId, attachment.id)
      .then((data) => {
        if (!active) return;
        url = URL.createObjectURL(blobFromData(data, attachment.mediaType));
        setPreview(url);
      })
      .catch(() => {
        if (active) setError("Could not load image preview");
      });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [isImage, attachment.id, attachment.mediaType, conversationId, load]);
  const download = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const data = await load(conversationId, attachment.id);
      const url = URL.createObjectURL(blobFromData(data, attachment.mediaType));
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Could not download attachment");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="da-sent-attachment">
      {preview && <img src={preview} alt={attachment.name} />}
      <button
        type="button"
        disabled={busy}
        onClick={() => void download()}
        title="Download attachment"
      >
        <strong>{attachment.name}</strong>
        <small>{busy ? "Downloading…" : fileSize(attachment.size)}</small>
      </button>
      {error && <span role="status">{error}</span>}
    </div>
  );
}
