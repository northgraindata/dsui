import { type ComponentProps, z } from "@northgraindata/dsui-plugin-sdk";
import { activityMessage } from "./activity";
import {
  AttachmentPicker,
  clipboardFiles,
  DraftAttachments,
  MessageAttachment,
  useAttachmentDraft,
} from "./attachment-ui";
import { ChatHistory } from "./chat-history";
import {
  type ChatTab,
  ChatTabs,
  type ChatTabUpdate,
  chatTabsReducer,
  newChatTab,
} from "./chat-tabs";
import { HighlightedMentions, MentionInput } from "./mention-input";
import { mentionServices } from "./mentions";
import { conversationSchema } from "./model";
import { ModelPicker } from "./model-picker";
import { usePanelResize } from "./panel-resize";
import { PromptNavigator } from "./prompt-navigator";
import { React, ReactDOM } from "./react";
import { type MessageReply, resolveReply } from "./replies";
import {
  ReplyQuote,
  ReplySelectionAction,
  useReplySelection,
} from "./reply-ui";
import { styles } from "./styles";

const stateSchema = z.object({
  configured: z.boolean(),
  model: z.object({ provider: z.string(), id: z.string() }),
  models: z
    .array(
      z.object({
        key: z.string(),
        label: z.string(),
        provider: z.string(),
        id: z.string(),
      }),
    )
    .default([]),
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      adapter: z.string(),
      adapterName: z.string().optional(),
      iconUrl: z.string().optional(),
    }),
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
  reply: "m9 5-6 6 6 6M3 11h10a7 7 0 0 1 7 7",
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
    title: "Explain an adapter",
    detail: "Discover what it can read",
    message:
      "Explain an adapter available in my workspace and the resources it can inspect.",
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
  const { width, resizing, resizeHandle } = usePanelResize(open);
  const [workspace, dispatch] = React.useReducer(
    chatTabsReducer,
    undefined,
    () => {
      const tab = newChatTab();
      return { tabs: [tab], activeId: tab.id };
    },
  );
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const openConversation = React.useCallback((id?: string) => {
    setHistoryOpen(false);
    dispatch({ type: "open", tab: newChatTab(id) });
  }, []);
  const updateTab = React.useCallback((id: string, update: ChatTabUpdate) => {
    dispatch({ type: "update", id, update });
  }, []);
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
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <Glyph name="history" />
        </button>
        <button
          type="button"
          className="da-icon-button"
          title="New chat"
          aria-label="New chat"
          onClick={() => openConversation()}
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
      <ChatTabs
        workspace={workspace}
        select={(id) => {
          setHistoryOpen(false);
          dispatch({ type: "select", id });
        }}
        close={(id) => dispatch({ type: "close", id, fallback: newChatTab() })}
      />
      {workspace.tabs.map((tab) => (
        <ChatSession
          key={tab.id}
          tab={tab}
          client={client}
          open={open}
          visible={open && tab.id === workspace.activeId}
          selectedTab={tab.id === workspace.activeId}
          historyOpen={historyOpen}
          setHistoryOpen={setHistoryOpen}
          openConversation={openConversation}
          updateTab={updateTab}
        />
      ))}
    </aside>
  );
}

function ChatSession({
  client,
  tab,
  open,
  visible,
  selectedTab,
  historyOpen,
  setHistoryOpen,
  openConversation,
  updateTab,
}: {
  client: ComponentProps["client"];
  tab: ChatTab;
  open: boolean;
  visible: boolean;
  selectedTab: boolean;
  historyOpen: boolean;
  setHistoryOpen(open: boolean): void;
  openConversation(id: string): void;
  updateTab(id: string, update: ChatTabUpdate): void;
}) {
  const { useState, useEffect, useRef, useCallback } = React;
  const [state, setState] = useState<State>();
  const [error, setError] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const attachmentDraft = useAttachmentDraft(setError);
  const [conversationId, setConversationId] = useState(tab.conversationId);
  const [modelKey, setModelKey] = useState<string>();
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState<MessageReply>();
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const messages = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const scrollPosition = useRef(0);
  const active = useRef(true);
  const modelConversation = useRef<string | undefined>(undefined);
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
  const loadAttachment = useCallback(
    async (conversationId: string, attachmentId: string) => {
      return z
        .object({ data: z.string() })
        .parse(await call("attachment", { conversationId, attachmentId })).data;
    },
    [call],
  );
  const load = useCallback(async () => {
    try {
      const requestedId = conversationRef.current;
      const result = stateSchema.parse(
        await call("state", { conversationId: requestedId }),
      );
      if (!active.current || requestedId !== conversationRef.current) return;
      setState(result);
      if (result.conversation)
        updateTab(tab.id, {
          conversationId: result.conversation.id,
          title: result.conversation.title,
          status: result.conversation.status,
        });
      setLoadError(undefined);
      if (
        result.conversation &&
        modelConversation.current !== result.conversation.id
      ) {
        modelConversation.current = result.conversation.id;
        setModelKey(result.conversation.modelKey);
      }
    } catch (cause) {
      if (active.current)
        setLoadError(
          cause instanceof Error ? cause.message : "Could not load agent",
        );
    }
  }, [call, tab.id, updateTab]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
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
    const interval = setInterval(() => void refresh(), visible ? 700 : 2500);
    return () => {
      clearInterval(interval);
    };
  }, [load, open, visible]);
  useEffect(() => {
    if (!visible) return;
    if (!document.activeElement?.closest('[role="tablist"]'))
      input.current?.focus({ preventScroll: true });
  }, [visible]);
  React.useLayoutEffect(() => {
    if (visible && scroll.current && !followLatest.current)
      scroll.current.scrollTop = scrollPosition.current;
  }, [visible]);
  const conversation = state?.conversation;
  const services = mentionServices(state?.services ?? []);
  const running = sending || conversation?.status === "running";
  const selectedModelKey = state?.models.some((model) => model.key === modelKey)
    ? modelKey
    : state?.models[0]?.key;
  const replySelection = useReplySelection(
    messages,
    visible && !running,
    conversation?.id,
  );
  const startReply = (messageId: string, selection?: string) => {
    if (running) return;
    setReply(
      resolveReply(conversation?.messages ?? [], { messageId, selection }),
    );
    window.getSelection()?.removeAllRanges();
    input.current?.focus();
  };
  const jumpToMessage = (id: string) => {
    const target = messages.current?.querySelector(
      `[data-message-id="${CSS.escape(id)}"]`,
    );
    if (target && scroll.current) {
      followLatest.current = false;
      const top =
        scroll.current.scrollTop +
        target.getBoundingClientRect().top -
        scroll.current.getBoundingClientRect().top -
        12;
      scroll.current.scrollTo({ top, behavior: "instant" });
    }
    if (target instanceof HTMLElement) target.focus({ preventScroll: true });
  };
  const lastText = conversation?.messages.at(-1)?.text;
  const activeMessageId =
    conversation?.status === "running"
      ? conversation.messages.at(-1)?.id
      : undefined;
  useEffect(() => {
    void lastText;
    void conversation?.id;
    if (visible && followLatest.current)
      bottom.current?.scrollIntoView({ block: "nearest" });
  }, [lastText, conversation?.id, visible]);
  const send = async (text: string) => {
    if (
      (!text.trim() && !attachmentDraft.attachments.length) ||
      running ||
      attachmentDraft.reading ||
      !state?.configured
    )
      return;
    setSending(true);
    followLatest.current = true;
    setError(undefined);
    try {
      const result = z.object({ conversationId: z.string() }).parse(
        await call("send", {
          conversationId,
          modelKey: selectedModelKey,
          message: text,
          replyTo: reply
            ? {
                messageId: reply.messageId,
                ...(reply.kind === "selection"
                  ? { selection: reply.text }
                  : {}),
              }
            : undefined,
          serviceIds: [],
          attachments: attachmentDraft.attachments.map(
            ({ name, mediaType, size, data }) => ({
              name,
              mediaType,
              size,
              data,
            }),
          ),
        }),
      );
      if (!active.current) return;
      conversationRef.current = result.conversationId;
      setConversationId(result.conversationId);
      updateTab(tab.id, {
        conversationId: result.conversationId,
        title: conversation?.title ?? "New chat",
        status: "running",
      });
      setDraft("");
      setReply(undefined);
      attachmentDraft.clear();
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
  const selectConversation = (id: string) => {
    setHistoryOpen(false);
    openConversation(id);
  };
  return (
    <section
      id={`da-session-${tab.id}`}
      role="tabpanel"
      aria-labelledby={`da-tab-${tab.id}`}
      className="da-chat-session"
      hidden={!selectedTab}
    >
      {historyOpen && visible && (
        <ChatHistory
          items={state?.conversations ?? []}
          disabled={sending}
          select={selectConversation}
          rename={async (id, title) => {
            await call("rename", { conversationId: id, title });
            await load();
          }}
        />
      )}
      {conversation && (
        <div className="da-chat-title">
          <span title={conversation.title}>{conversation.title}</span>
          {visible && (
            <PromptNavigator
              key={conversation.id}
              messages={conversation.messages}
              jump={jumpToMessage}
            />
          )}
        </div>
      )}
      <div
        className="da-scroll"
        ref={scroll}
        onScroll={() => {
          if (!visible) return;
          const element = scroll.current;
          if (element) {
            scrollPosition.current = element.scrollTop;
            followLatest.current =
              element.scrollHeight - element.clientHeight - element.scrollTop <
              80;
          }
        }}
      >
        {!state && !error && !loadError && (
          <p className="da-muted" role="status">
            Connecting to your workspace…
          </p>
        )}
        {state && !state.configured && (
          <div className="da-setup">
            <strong>Connect your model</strong>
            <p>
              Add your model and API key under{" "}
              <code>plugins.ai-agent.config.model</code> (or <code>models</code>
              ) in <code>dsui.yaml</code>, then restart DSUI.
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
          ref={messages}
          className="da-messages"
          role="log"
          aria-label="Conversation messages"
        >
          {conversation?.messages.map((message) =>
            message.role === "user" ? (
              <div
                className="da-user-row"
                key={message.id}
                data-message-id={message.id}
                tabIndex={-1}
              >
                <div className="da-user-message">
                  {message.replyTo && (
                    <ReplyQuote
                      reply={message.replyTo}
                      onJump={() =>
                        jumpToMessage(message.replyTo?.messageId ?? "")
                      }
                    />
                  )}
                  {message.attachments.length > 0 && (
                    <div className="da-attachments">
                      {message.attachments.map((attachment) => (
                        <MessageAttachment
                          key={attachment.id}
                          attachment={attachment}
                          conversationId={conversation.id}
                          load={loadAttachment}
                        />
                      ))}
                    </div>
                  )}
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
                  <button
                    type="button"
                    className="da-message-reply"
                    disabled={running}
                    aria-label="Reply to your message"
                    onClick={() => startReply(message.id)}
                  >
                    <Glyph name="reply" size={14} /> Reply
                  </button>
                </div>
                <span className="da-avatar">You</span>
              </div>
            ) : (
              <div
                className="da-assistant-row"
                key={message.id}
                data-message-id={message.id}
                data-reply-message-id={message.id}
                tabIndex={-1}
              >
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
                  <MessageTools
                    tools={conversation.tools}
                    messageId={message.id}
                  />
                  {message.text && message.id !== activeMessageId && (
                    <button
                      type="button"
                      className="da-message-reply"
                      disabled={running}
                      aria-label="Reply to agent message"
                      onClick={() => startReply(message.id)}
                    >
                      <Glyph name="reply" size={14} /> Reply
                    </button>
                  )}
                  {message.model && (
                    <small
                      className="da-response-model"
                      title={message.model.provider}
                    >
                      {message.model.id}
                    </small>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
        {(error || loadError || conversation?.error) && (
          <div className="da-error" role="alert">
            <Glyph name="alert" />
            <p>{error ?? loadError ?? conversation?.error}</p>
          </div>
        )}
        <div ref={bottom} />
      </div>
      <footer className="da-footer">
        <form
          className="da-composer"
          onPaste={(event) => {
            const files = clipboardFiles(event.clipboardData);
            if (!files.length) return;
            event.preventDefault();
            if (sending || !state?.configured) return;
            setError(undefined);
            void attachmentDraft.addFiles(files);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          {reply && (
            <ReplyQuote
              reply={reply}
              onRemove={() => {
                setReply(undefined);
                input.current?.focus();
              }}
            />
          )}
          {attachmentDraft.attachments.length > 0 && (
            <DraftAttachments
              attachments={attachmentDraft.attachments}
              disabled={sending}
              remove={attachmentDraft.remove}
            />
          )}
          {attachmentDraft.reading && (
            <span className="da-thinking" role="status">
              Reading attachments…
            </span>
          )}
          <MentionInput
            inputRef={input}
            services={services}
            value={draft}
            disabled={!state?.configured || sending}
            onChange={setDraft}
            onSend={() => void send(draft)}
          />
          <div className="da-composer-bar">
            <AttachmentPicker
              disabled={
                sending || attachmentDraft.reading || !state?.configured
              }
              onFiles={(files) => {
                setError(undefined);
                void attachmentDraft.addFiles(files);
              }}
            />
            <ModelPicker
              models={state?.models ?? []}
              selectedKey={selectedModelKey}
              disabled={running || !visible}
              onSelect={setModelKey}
            />
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
                disabled={
                  (!draft.trim() && !attachmentDraft.attachments.length) ||
                  attachmentDraft.reading ||
                  !state?.configured
                }
              >
                <Glyph name="send" size={18} />
              </button>
            )}
          </div>
        </form>
        <small>Agent can make mistakes. Always verify important results.</small>
      </footer>
      {visible && (
        <ReplySelectionAction selection={replySelection} onReply={startReply} />
      )}
    </section>
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

function MessageTools({
  tools,
  messageId,
}: {
  tools: z.infer<typeof conversationSchema>["tools"];
  messageId: string;
}) {
  const used = tools.filter((tool) => tool.messageId === messageId);
  if (!used.length) return null;
  return (
    <details className="da-message-tools">
      <summary>
        <Glyph name="tools" size={14} />
        Tools used · {used.length}
      </summary>
      <ul>
        {used.map((tool) => (
          <li key={tool.id}>
            <span className={`da-tool-dot ${tool.status}`} />
            <code>{tool.name}</code>
            <span>{tool.status}</span>
          </li>
        ))}
      </ul>
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
      const schemaTable =
        headers.length >= 2 &&
        headers.length <= 3 &&
        /^(?:column(?: name)?|name)$/i.test(
          (headers[0] ?? "").replace(/`/g, ""),
        ) &&
        /^(?:data )?type$/i.test((headers[1] ?? "").replace(/`/g, ""));
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(splitMarkdownTableRow(lines[index] ?? ""));
        index += 1;
      }
      blocks.push(
        <div className="da-markdown-table-wrap" key={`table:${index}`}>
          <table
            className="da-markdown-table"
            data-schema={schemaTable || undefined}
          >
            {schemaTable && (
              <colgroup>
                <col style={{ width: headers.length === 3 ? "42%" : "55%" }} />
                <col style={{ width: headers.length === 3 ? "33%" : "45%" }} />
                {headers.length === 3 && <col style={{ width: "25%" }} />}
              </colgroup>
            )}
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
