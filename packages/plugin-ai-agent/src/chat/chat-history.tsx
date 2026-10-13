import { React } from "./react";

type Chat = { id: string; title: string; status: string };
export function ChatHistory({
  items,
  disabled,
  select,
  rename,
}: {
  items: readonly Chat[];
  disabled: boolean;
  select(id: string): void;
  rename(id: string, title: string): Promise<void>;
}) {
  const [editing, setEditing] = React.useState<string>();
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  const save = async () => {
    if (!editing || !title.trim() || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await rename(editing, title.trim());
      setEditing(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not rename chat",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="da-history" aria-label="Conversation history">
      <strong>Conversations</strong>
      {items.map((item) => (
        <div className="da-history-row" key={item.id}>
          {editing === item.id ? (
            <form
              className="da-rename-form"
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <input
                ref={input}
                aria-label="Chat name"
                value={title}
                maxLength={70}
                required
                disabled={saving}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditing(undefined);
                  }
                }}
              />
              <button type="submit" disabled={saving || !title.trim()}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(undefined);
                  setError(undefined);
                }}
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                type="button"
                className="da-history-select"
                disabled={disabled || saving}
                onClick={() => select(item.id)}
              >
                {item.title}
              </button>
              <button
                type="button"
                className="da-history-rename"
                title="Rename chat"
                aria-label={`Rename ${item.title}`}
                disabled={disabled || saving || item.status === "running"}
                onClick={() => {
                  setEditing(item.id);
                  setTitle(item.title);
                  setError(undefined);
                }}
              >
                <svg
                  aria-hidden="true"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5" />
                </svg>
              </button>
            </>
          )}
        </div>
      ))}
      {!items.length && <p>No conversations yet.</p>}
      {error && (
        <p className="da-history-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
