import { type ComponentProps, z } from "@northgraindata/dsui-plugin-sdk";
import { activityMessage } from "./activity";
import { HighlightedMentions, MentionInput } from "./mention-input";
import { mentionServices, serviceMentions } from "./mentions";
import { conversationSchema } from "./model";
import { usePanelResize } from "./panel-resize";
import { React, ReactDOM } from "./react";
import { styles } from "./styles";

const stateSchema = z.object({
  configured: z.boolean(),
  model: z.object({ provider: z.string(), id: z.string() }),
  services: z.array(
    z.object({ id: z.string(), name: z.string(), adapter: z.string() }),
  ),
  conversations: z.array(
    z.object({ id: z.string(), title: z.string(), status: z.string() }),
  ),
  conversation: conversationSchema.optional(),
});
type State = z.infer<typeof stateSchema>;
const icons: Record<string, string> = {
  sparkle:
    "m12 3 2.8 6.2L21 12l-6.2 2.8L12 21l-2.8-6.2L3 12l6.2-2.8Z M20 2v4M18 4h4",
  close: "m6 6 12 12M18 6 6 18",
  search: "M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  database:
    "M4 6c0-5 16-5 16 0s-16 5-16 0Zm0 0v12c0 5 16 5 16 0V6M4 12c0 5 16 5 16 0",
  alert: "m12 3 10 18H2Z M12 9v5m0 3v.1",
  stack: "m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16",
  send: "m3 3 18 9-18 9 4-9-4-9Zm4 9h14",
  plus: "M12 5v14M5 12h14",
  history: "M3 12a9 9 0 1 0 3-7M3 3v6h6M12 7v5l3 2",
  stop: "M5 5h14v14H5Z",
  chevron: "m8 10 4 4 4-4",
  tools: "m4 4 16 16M14 4a5 5 0 0 0 6 6M4 14a5 5 0 0 0 6 6",
};
function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={icons[name] ?? icons.sparkle} />
    </svg>
  );
}
function AgentMark() {
  return (
    <span className="da-mark">
      <Glyph name="sparkle" size={23} />
    </span>
  );
}

const suggestions = [
  {
    icon: "search",
    title: "Diagnose my stack",
    detail: "Check services for issues",
    message: "Check the health of my data stack and explain any issues.",
  },
  {
    icon: "database",
    title: "Why is my database unavailable?",
    detail: "Analyze connection errors",
    message:
      "Investigate any unavailable database services and explain likely causes.",
  },
  {
    icon: "alert",
    title: "Show recent failures",
    detail: "Find issues across tools",
    message:
      "Find recent recorded failures in my data stack. Show the evidence.",
  },
  {
    icon: "stack",
    title: "Explore my data",
    detail: "Discover tables and schemas",
    message:
      "Explore the available data catalogs. What tables and schemas can I inspect?",
  },
  {
    icon: "code",
    title: "Explain this adapter",
    detail: "Discover what it can read",
    message:
      "Explain the selected service's adapter and the resources available to inspect.",
  },
  {
    icon: "database",
    title: "Explore dbt models",
    detail: "Inspect models and run results",
    message:
      "Discover my dbt models and summarize the latest available run results.",
  },
];

export function AgentLauncher({ client }: ComponentProps) {
  const { useState, useEffect, useRef, useCallback } = React;
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const show = useCallback(() => {
    setMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        if (open) close();
        else show();
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, close, show]);
  return (
    <>
      <style>{styles}</style>
      <button
        type="button"
        ref={trigger}
        className="da-trigger"
        title="Open agent · ⌘ J"
        aria-label="Open DSUI Agent"
        aria-expanded={open}
        aria-controls="dsui-agent-panel"
        onClick={() => (open ? close() : show())}
      >
        <Glyph name="sparkle" size={21} />
      </button>
      {mounted &&
        ReactDOM.createPortal(
          <>
            <style>{styles}</style>
            <AgentPanel client={client} open={open} close={close} />
          </>,
          document.body,
        )}
    </>
  );
}

function AgentPanel({
  client,
  open,
  close,
}: {
  client: ComponentProps["client"];
  open: boolean;
  close(): void;
}) {
  const { useState, useEffect, useRef, useCallback } = React;
  const [state, setState] = useState<State>();
  const { width, resizing, resizeHandle } = usePanelResize(open);
  const [error, setError] = useState<string>();
  const [conversationId, setConversationId] = useState<string>();
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const contextConversation = useRef<string | undefined>(undefined);
  const conversationRef = useRef(conversationId);
  conversationRef.current = conversationId;
  const call = useCallback(
    async (actionId: string, args: unknown) => {
      const result = await client.executeAction({ actionId, input: args });
      if (result.status === "error")
        throw new Error(result.message ?? "Agent request failed");
      return result.data;
    },
    [client],
  );
  const load = useCallback(async () => {
    try {
      const requestedId = conversationRef.current;
      const result = stateSchema.parse(
        await call("state", { conversationId: requestedId }),
      );
      if (!active.current || requestedId !== conversationRef.current) return;
      setState(result);
      setError(undefined);
      if (
        result.conversation &&
        contextConversation.current !== result.conversation.id
      ) {
        contextConversation.current = result.conversation.id;
        setSelected(result.conversation.serviceIds);
      }
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof Error ? cause.message : "Could not load agent",
        );
    }
  }, [call]);
  useEffect(() => {
    active.current = true;
    if (!open) return;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        await load();
      } finally {
        busy = false;
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 700);
    return () => {
      active.current = false;
      clearInterval(interval);
    };
  }, [load, open]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const conversation = state?.conversation;
  const services = mentionServices(state?.services ?? []);
  const mentionedCount = new Set(
    serviceMentions(draft, services).flatMap((mention) =>
      mention.service ? [mention.service.id] : [],
    ),
  ).size;
  const running = sending || conversation?.status === "running";
  const lastText = conversation?.messages.at(-1)?.text;
  const activeMessageId =
    conversation?.status === "running"
      ? conversation.messages.at(-1)?.id
      : undefined;
  useEffect(() => {
    void lastText;
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [lastText]);
  const send = async (text: string) => {
    if (!text.trim() || running || !state?.configured) return;
    setSending(true);
    setError(undefined);
    try {
      const result = z.object({ conversationId: z.string() }).parse(
        await call("send", {
          conversationId,
          message: text,
          serviceIds: selected,
        }),
      );
      if (!active.current) return;
      conversationRef.current = result.conversationId;
      setConversationId(result.conversationId);
      setDraft("");
      await load();
    } catch (cause) {
      if (active.current)
        setError(
          cause instanceof Error ? cause.message : "Could not send message",
        );
    } finally {
      if (active.current) setSending(false);
    }
  };
  const fresh = () => {
    if (sending) return;
    contextConversation.current = undefined;
    conversationRef.current = undefined;
    setConversationId(undefined);
    setState((current) =>
      current ? { ...current, conversation: undefined } : current,
    );
    setSelected([]);
    setHistoryOpen(false);
    input.current?.focus();
  };
  const selectConversation = (id: string) => {
    if (sending) return;
    contextConversation.current = undefined;
    conversationRef.current = id;
    setConversationId(id);
    setHistoryOpen(false);
    void load();
  };
  const toggleService = (id: string) => {
    if (running) return;
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  };
  return (
    <aside
      id="dsui-agent-panel"
      className="da-panel"
      data-open={open}
      data-workspace-panel={open ? "open" : "closed"}
      data-resizing={resizing}
      style={{ width }}
      inert={!open}
      role="dialog"
      aria-modal="false"
      aria-label="DSUI Agent"
    >
      {resizeHandle}
      <header className="da-header">
        <span className="da-outline-mark">
          <Glyph name="sparkle" size={20} />
        </span>
        <h2>DSUI Agent</h2>
        <button
          type="button"
          className="da-icon-button"
          title="Conversation history"
          aria-label="Conversation history"
          disabled={sending}
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <Glyph name="history" />
        </button>
        <button
          type="button"
          className="da-icon-button"
          title="New chat"
          aria-label="New chat"
          disabled={sending}
          onClick={fresh}
        >
          <Glyph name="plus" />
        </button>
        <button
          type="button"
          className="da-icon-button"
          aria-label="Close agent"
          onClick={close}
        >
          <Glyph name="close" />
        </button>
      </header>
      {historyOpen && (
        <section className="da-history">
          <strong>Conversations</strong>
          {state?.conversations.length ? (
            state.conversations.map((item) => (
              <button
                type="button"
                key={item.id}
                disabled={sending}
                onClick={() => selectConversation(item.id)}
              >
                {item.title}
                <Glyph name="chevron" size={14} />
              </button>
            ))
          ) : (
            <p>No conversations yet.</p>
          )}
        </section>
      )}
      <div className="da-context">
        <span>Context:</span>
        <button
          type="button"
          className={!selected.length ? "selected" : ""}
          disabled={running}
          onClick={() => setSelected([])}
        >
          <Glyph name="stack" size={13} />
          Workspace
        </button>
        {state?.services
          .filter((service) => selected.includes(service.id))
          .map((service) => (
            <button
              type="button"
              className="selected"
              key={service.id}
              disabled={running}
              onClick={() => toggleService(service.id)}
            >
              {service.name}
            </button>
          ))}
        <button
          type="button"
          disabled={running}
          aria-label="Select services"
          aria-expanded={contextOpen}
          onClick={() => setContextOpen(!contextOpen)}
        >
          <Glyph name="plus" size={15} />
        </button>
      </div>
      {contextOpen && (
        <div className="da-service-picker">
          {state?.services.map((service) => (
            <label key={service.id}>
              <input
                type="checkbox"
                checked={selected.includes(service.id)}
                disabled={running}
                onChange={() => toggleService(service.id)}
              />
              {service.name}
              <small>{service.adapter}</small>
            </label>
          ))}
          {!state?.services.length && <p>No accessible services.</p>}
        </div>
      )}
      <div className="da-scroll">
        {!state && !error && (
          <p className="da-muted" role="status">
            Connecting to your workspace…
          </p>
        )}
        {state && !state.configured && (
          <div className="da-setup">
            <strong>Connect your model</strong>
            <p>
              Add your model and API key under{" "}
              <code>plugins.ai-agent.config.model</code> in{" "}
              <code>dsui.yaml</code>, then restart DSUI.
            </p>
            <p>Your key stays on the server.</p>
          </div>
        )}
        {!sending && !conversation?.messages.length && (
          <section className="da-welcome">
            <div className="da-welcome-title">
              <AgentMark />
              <div>
                <h3>How can I help you today?</h3>
                <p>
                  I can analyze your data stack, investigate issues and explore
                  data across your tools.
                </p>
              </div>
            </div>
            <div className="da-suggestions">
              {suggestions.map((item) => (
                <button
                  type="button"
                  key={item.title}
                  disabled={running || !state?.configured}
                  onClick={() => void send(item.message)}
                >
                  <Glyph name={item.icon} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
        <div
          className="da-messages"
          role="log"
          aria-label="Conversation messages"
        >
          {conversation?.messages.map((message) =>
            message.role === "user" ? (
              <div className="da-user-row" key={message.id}>
                <div className="da-user-message">
                  <p>
                    <HighlightedMentions
                      text={message.text}
                      services={services}
                    />
                  </p>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <span className="da-avatar">You</span>
              </div>
            ) : (
              <div className="da-assistant-row" key={message.id}>
                <AgentMark />
                <div className="da-assistant-message">
                  {message.text && (
                    <MessageText text={message.text} services={services} />
                  )}
                  {message.id === activeMessageId && (
                    <span
                      className="da-thinking"
                      role="status"
                      data-after-text={Boolean(message.text)}
                    >
                      {activityMessage(
                        conversation.tools.filter(
                          (tool) => tool.messageId === message.id,
                        ),
                        state?.services ?? [],
                        Boolean(message.text),
                      )}
                      <span>…</span>
                    </span>
                  )}
                  {!message.text && message.id !== activeMessageId && (
                    <span className="da-muted">No response was produced.</span>
                  )}
                  {conversation.tools
                    .filter(
                      (tool) =>
                        tool.messageId === message.id &&
                        tool.name === "get_service_health" &&
                        tool.status === "completed",
                    )
                    .map((tool) => (
                      <HealthCard
                        key={tool.id}
                        output={tool.output}
                        services={state?.services ?? []}
                        disabled={running}
                        send={send}
                      />
                    ))}
                </div>
              </div>
            ),
          )}
        </div>
        {conversation?.tools.length ? (
          <details className="da-evidence">
            <summary>
              <Glyph name="tools" size={14} />
              {conversation.tools.length} tool calls · inspect evidence
            </summary>
            {conversation.tools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </details>
        ) : null}
        {(error || conversation?.error) && (
          <div className="da-error" role="alert">
            <Glyph name="alert" />
            <p>{error ?? conversation?.error}</p>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <footer className="da-footer">
        <form
          className="da-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <MentionInput
            inputRef={input}
            services={services}
            value={draft}
            disabled={!state?.configured}
            onChange={setDraft}
            onSend={() => void send(draft)}
          />
          <div className="da-composer-bar">
            <button
              type="button"
              className="da-composer-context"
              onClick={() => setContextOpen(!contextOpen)}
              disabled={running}
              aria-expanded={contextOpen}
            >
              <Glyph name="stack" size={14} />
              {mentionedCount ? "Mentions" : "Context"}:{" "}
              {mentionedCount || selected.length
                ? `${mentionedCount || selected.length} service${(mentionedCount || selected.length) > 1 ? "s" : ""}`
                : "Workspace"}
              <Glyph name="chevron" size={13} />
            </button>
            {running ? (
              <button
                type="button"
                className="da-send"
                aria-label="Stop response"
                onClick={() => {
                  if (conversationId)
                    void call("cancel", { conversationId }).catch(
                      (cause: unknown) =>
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Could not stop response",
                        ),
                    );
                }}
              >
                <Glyph name="stop" size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="da-send"
                aria-label="Send message"
                disabled={!draft.trim() || !state?.configured}
              >
                <Glyph name="send" size={18} />
              </button>
            )}
          </div>
        </form>
        <small>Agent can make mistakes. Always verify important results.</small>
      </footer>
    </aside>
  );
}

const healthSchema = z.object({
  id: z.string(),
  health: z.enum(["healthy", "warning", "unavailable", "unknown"]),
  detail: z.string().optional(),
  latencyMs: z.number().optional(),
  checks: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        ok: z.boolean(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
});
function HealthCard({
  output,
  services,
  disabled,
  send,
}: {
  output: unknown;
  services: State["services"];
  disabled: boolean;
  send(text: string): Promise<void>;
}) {
  const parsed = healthSchema.safeParse(output);
  if (!parsed.success) return null;
  const health = parsed.data;
  const service = services.find((item) => item.id === health.id);
  const failed = health.health === "unavailable";
  return (
    <section
      className={`da-health${failed ? " failed" : ""}`}
      aria-label="Measured service health"
    >
      <strong>
        <Glyph name={failed ? "alert" : "database"} size={15} />
        {service?.name ?? health.id} · {health.health}
      </strong>
      {health.detail && <p className="da-health-detail">{health.detail}</p>}
      <dl>
        <div>
          <dt>Service</dt>
          <dd>{health.id}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd className="da-health-status">{health.health}</dd>
        </div>
        {service && (
          <div>
            <dt>Adapter</dt>
            <dd>{service.adapter}</dd>
          </div>
        )}
        {health.latencyMs !== undefined && (
          <div>
            <dt>Latency</dt>
            <dd>{health.latencyMs} ms</dd>
          </div>
        )}
      </dl>
      {health.checks?.map((check) => (
        <p key={check.id}>
          {check.ok ? "✓" : "×"} {check.label}
          {check.detail ? `: ${check.detail}` : ""}
        </p>
      ))}
      <div className="da-health-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            void send(
              `Test the connection and report current health for @${health.id}.`,
            )
          }
        >
          <Glyph name="send" size={13} />
          Test connection
        </button>
        <a href={`/services/${encodeURIComponent(health.id)}`}>
          <Glyph name="database" size={13} />
          Open adapter
        </a>
        <a href="/settings">
          <Glyph name="code" size={13} />
          Inspect config
        </a>
      </div>
    </section>
  );
}

function ToolCard({
  tool,
}: {
  tool: z.infer<typeof conversationSchema>["tools"][number];
}) {
  return (
    <details className="da-tool-card">
      <summary>
        <span className={`da-tool-dot ${tool.status}`} />
        <code>{tool.name}</code>
        <span>{tool.status}</span>
      </summary>
      <strong>Arguments</strong>
      <pre>{JSON.stringify(tool.input, null, 2)}</pre>
      {tool.output !== undefined && (
        <>
          <strong>Result</strong>
          <pre>{JSON.stringify(tool.output, null, 2)}</pre>
        </>
      )}
    </details>
  );
}

function renderInlineMarkdown(
  value: string,
  services: ReturnType<typeof mentionServices>,
) {
  const tokens = value.split(
    /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^\s)]+\))/g,
  );
  return tokens.map((token, index) => {
    const key = `${index}:${token}`;
    if (token.startsWith("**") && token.endsWith("**"))
      return (
        <strong key={key}>
          {renderInlineMarkdown(token.slice(2, -2), services)}
        </strong>
      );
    if (token.startsWith("__") && token.endsWith("__"))
      return (
        <strong key={key}>
          {renderInlineMarkdown(token.slice(2, -2), services)}
        </strong>
      );
    if (token.startsWith("~~") && token.endsWith("~~"))
      return (
        <del key={key}>
          {renderInlineMarkdown(token.slice(2, -2), services)}
        </del>
      );
    if (token.startsWith("*") && token.endsWith("*"))
      return (
        <em key={key}>{renderInlineMarkdown(token.slice(1, -1), services)}</em>
      );
    if (token.startsWith("`") && token.endsWith("`"))
      return <code key={key}>{token.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token);
    if (link) {
      const [, label, href] = link;
      if (
        label &&
        href &&
        (href.startsWith("/services/") || /^https:\/\//.test(href))
      )
        return (
          <a
            key={key}
            href={href}
            target={href.startsWith("https:") ? "_blank" : undefined}
            rel="noreferrer"
          >
            {label}
          </a>
        );
      return <React.Fragment key={key}>{token}</React.Fragment>;
    }
    return (
      <React.Fragment key={key}>
        <HighlightedMentions text={token} services={services} />
      </React.Fragment>
    );
  });
}

const codeTokens =
  /(\/\/[^\n]*|--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:async|await|const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|try|catch|throw|SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|GROUP|BY|ORDER|LIMIT|INSERT|UPDATE|DELETE|CREATE|TABLE|AS|AND|OR|NOT|NULL|TRUE|FALSE|WITH|INTO|VALUES|def|print|pass|None|True|False)\b|\b\d+(?:\.\d+)?\b)/g;

function HighlightedCode({ code }: { code: string }) {
  return (
    <>
      {code.split(codeTokens).map((part, index) => {
        const key = `${index}:${part}`;
        if (/^(\/\/|--|#|\/\*)/.test(part))
          return (
            <span className="da-code-comment" key={key}>
              {part}
            </span>
          );
        if (
          /^"/.test(part) &&
          /:\s*$/.test(code.slice(code.indexOf(part) + part.length))
        )
          return (
            <span className="da-code-key" key={key}>
              {part}
            </span>
          );
        if (/^("|'|`)/.test(part))
          return (
            <span className="da-code-string" key={key}>
              {part}
            </span>
          );
        if (/^\d/.test(part))
          return (
            <span className="da-code-number" key={key}>
              {part}
            </span>
          );
        if (
          /^(?:async|await|const|let|var|function|return|if|else|for|while|class|new|import|from|export|default|try|catch|throw|SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|GROUP|BY|ORDER|LIMIT|INSERT|UPDATE|DELETE|CREATE|TABLE|AS|AND|OR|NOT|NULL|TRUE|FALSE|WITH|INTO|VALUES|def|print|pass|None|True|False)$/.test(
            part,
          )
        )
          return (
            <span className="da-code-keyword" key={key}>
              {part}
            </span>
          );
        return <React.Fragment key={key}>{part}</React.Fragment>;
      })}
    </>
  );
}

/** Render Markdown without interpreting HTML supplied by the model. */
function MessageText({
  text,
  services,
}: {
  text: string;
  services: ReturnType<typeof mentionServices>;
}) {
  return (
    <div className="da-message-text">{renderMarkdown(text, services)}</div>
  );
}

function renderMarkdown(
  text: string,
  services: ReturnType<typeof mentionServices>,
) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = /^\s*(```+|~~~+)(.*)$/.exec(line);
    if (fence) {
      const marker = fence[1]?.[0] ?? "`";
      const codeLines: string[] = [];
      index += 1;
      while (
        index < lines.length &&
        !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[index] ?? "")
      ) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre className="da-code-block" key={`code:${index}`}>
          <code data-language={fence[2]?.trim() || "text"}>
            <HighlightedCode code={codeLines.join("\n")} />
          </code>
        </pre>,
      );
      continue;
    }
    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(
        lines[index + 1] ?? "",
      )
    ) {
      const headers = splitMarkdownTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(splitMarkdownTableRow(lines[index] ?? ""));
        index += 1;
      }
      blocks.push(
        <div className="da-markdown-table-wrap" key={`table:${index}`}>
          <table className="da-markdown-table">
            <thead>
              <tr>
                {headers.map((cell, cellIndex) => (
                  <th key={`${cellIndex}:${cell}`}>
                    {renderInlineMarkdown(cell, services)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row:${rowIndex}`}>
                  {headers.map((_, cellIndex) => {
                    const cell = row[cellIndex] ?? "";
                    return (
                      <td key={`${cellIndex}:${cell}`}>
                        {renderInlineMarkdown(cell, services)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push(
        <h3 key={`heading:${index}`}>
          {renderInlineMarkdown(heading[2] ?? "", services)}
        </h3>,
      );
      index += 1;
      continue;
    }
    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) {
      blocks.push(<hr key={`rule:${index}`} />);
      index += 1;
      continue;
    }
    const listItem = /^\s*([-*+] |\d+\. )(.*)$/.exec(line);
    if (listItem) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (index < lines.length) {
        const item = /^\s*([-*+] |\d+\. )(.*)$/.exec(lines[index] ?? "");
        if (!item || ordered !== /^\s*\d+\./.test(lines[index] ?? "")) break;
        items.push(
          <li key={`item:${index}`}>
            {renderInlineMarkdown(item[2] ?? "", services)}
          </li>,
        );
        index += 1;
      }
      blocks.push(
        ordered ? (
          <ol key={`list:${index}`}>{items}</ol>
        ) : (
          <ul key={`list:${index}`}>{items}</ul>
        ),
      );
      continue;
    }
    if (line.startsWith("> ")) {
      const quote = [];
      while (index < lines.length && (lines[index] ?? "").startsWith("> ")) {
        quote.push(
          renderInlineMarkdown((lines[index] ?? "").slice(2), services),
        );
        index += 1;
      }
      blocks.push(
        <blockquote key={`quote:${index}`}>
          {quote.map((content, quoteIndex) => (
            <p key={quoteIndex}>{content}</p>
          ))}
        </blockquote>,
      );
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      (lines[index] ?? "").trim() &&
      !/^(#{1,6}\s|\s*(```|~~~)|\s*([-*+] |\d+\. )|> )/.test(lines[index] ?? "")
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    blocks.push(
      <p key={`paragraph:${index}`}>
        {renderInlineMarkdown(paragraph.join(" "), services)}
      </p>,
    );
  }
  return blocks;
}

function splitMarkdownTableRow(value: string): string[] {
  return value
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
