import { type KeyboardEvent, useEffect, useRef, useState } from "react";

export function EditableText({
  value,
  onChange,
  multiline = false,
  className,
  readOnly = false,
  onCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  className?: string;
  readOnly?: boolean;
  onCommit?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputEditor = useRef<HTMLInputElement>(null);
  const textareaEditor = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (!editing) return;
    if (multiline) textareaEditor.current?.focus();
    else inputEditor.current?.focus();
  }, [editing, multiline]);

  const save = () => {
    if (readOnly) return;
    onChange(draft);
    onCommit?.(draft);
    setEditing(false);
  };
  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (!multiline && event.key === "Enter") save();
    if (event.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };
  if (readOnly) return <span className={className}>{value || "Untitled"}</span>;
  if (editing) {
    if (multiline)
      return (
        <textarea
          ref={textareaEditor}
          className={className}
          value={draft}
          aria-label="Edit notebook text"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
        />
      );
    return (
      <input
        ref={inputEditor}
        className={className}
        value={draft}
        aria-label="Edit notebook text"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
      />
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={() => setEditing(true)}
    >
      {value || "Click to add text"}
    </button>
  );
}
