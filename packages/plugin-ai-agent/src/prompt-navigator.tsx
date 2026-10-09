import { React } from "./react";

type PromptMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments: readonly { name: string }[];
};

export function promptItems(messages: readonly PromptMessage[]) {
  return messages
    .filter((message) => message.role === "user")
    .map((message, index) => {
      const text =
        message.text.trim().replace(/\s+/g, " ") ||
        message.attachments[0]?.name ||
        "Attached files";
      return {
        id: message.id,
        number: index + 1,
        headline: text.length > 100 ? `${text.slice(0, 100)}…` : text,
      };
    });
}

export function PromptNavigator({
  messages,
  jump,
}: {
  messages: readonly PromptMessage[];
  jump(id: string): void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const root = React.useRef<HTMLElement>(null);
  const search = React.useRef<HTMLInputElement>(null);
  const id = React.useId();
  const prompts = promptItems(messages);
  React.useEffect(() => {
    if (!open) return;
    search.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      root.current?.querySelector("button")?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", dismiss, true);
    };
  }, [open]);
  const visible = prompts.filter((prompt) =>
    `${prompt.number} ${prompt.headline}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <nav className="da-prompt-nav" ref={root} aria-label="Prompts in this chat">
      <button
        type="button"
        className="da-prompt-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        disabled={!prompts.length}
      >
        Prompts <span>{prompts.length}</span> ▾
      </button>
      {open && (
        <section
          className="da-prompt-menu"
          id={id}
          aria-label="Jump to a prompt"
        >
          <strong>Jump to a prompt</strong>
          <input
            ref={search}
            aria-label="Search prompts"
            placeholder="Search prompts…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <ol>
            {visible.map((prompt) => (
              <li key={prompt.id}>
                <button
                  type="button"
                  title={prompt.headline}
                  onClick={() => {
                    setOpen(false);
                    jump(prompt.id);
                  }}
                >
                  <span>{prompt.number}</span>
                  <span>{prompt.headline}</span>
                </button>
              </li>
            ))}
          </ol>
          {!visible.length && <p>No matching prompts.</p>}
        </section>
      )}
    </nav>
  );
}
