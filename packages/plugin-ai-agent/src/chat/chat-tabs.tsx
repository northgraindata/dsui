import { React } from "./react";

export type ChatTab = {
  id: string;
  conversationId?: string;
  title: string;
  status: string;
};
export type ChatWorkspace = { tabs: ChatTab[]; activeId: string };
export type ChatTabUpdate = Pick<
  ChatTab,
  "conversationId" | "title" | "status"
>;
type TabAction =
  | { type: "open"; tab: ChatTab }
  | { type: "select"; id: string }
  | { type: "close"; id: string; fallback: ChatTab }
  | { type: "update"; id: string; update: ChatTabUpdate };

export function newChatTab(conversationId?: string): ChatTab {
  return {
    id: crypto.randomUUID(),
    conversationId,
    title: conversationId ? "Loading chat…" : "New chat",
    status: "idle",
  };
}

function unchangedTab(current: ChatTab, update: ChatTabUpdate) {
  return (
    current.conversationId === update.conversationId &&
    current.title === update.title &&
    current.status === update.status
  );
}

export function chatTabsReducer(
  state: ChatWorkspace,
  action: TabAction,
): ChatWorkspace {
  switch (action.type) {
    case "open": {
      const existing = state.tabs.find(
        (tab) =>
          Boolean(action.tab.conversationId) &&
          tab.conversationId === action.tab.conversationId,
      );
      return existing
        ? { ...state, activeId: existing.id }
        : { tabs: [...state.tabs, action.tab], activeId: action.tab.id };
    }
    case "select":
      return state.tabs.some((tab) => tab.id === action.id)
        ? { ...state, activeId: action.id }
        : state;
    case "close": {
      const index = state.tabs.findIndex((tab) => tab.id === action.id);
      if (index === -1) return state;
      const tabs = state.tabs.filter((tab) => tab.id !== action.id);
      if (!tabs.length)
        return { tabs: [action.fallback], activeId: action.fallback.id };
      return {
        tabs,
        activeId:
          state.activeId === action.id
            ? (tabs[Math.min(index, tabs.length - 1)]?.id ?? state.activeId)
            : state.activeId,
      };
    }
    case "update": {
      const current = state.tabs.find((tab) => tab.id === action.id);
      if (!current || unchangedTab(current, action.update)) return state;
      return {
        ...state,
        tabs: state.tabs.map((tab) =>
          tab.id === action.id ? { ...tab, ...action.update } : tab,
        ),
      };
    }
  }
}

export function ChatTabs({
  workspace,
  select,
  close,
}: {
  workspace: ChatWorkspace;
  select(id: string): void;
  close(id: string): void;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    root.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [workspace.activeId]);
  return (
    <div
      className="da-chat-tabs"
      role="tablist"
      aria-label="Open chats"
      ref={root}
    >
      {workspace.tabs.map((tab, index) => (
        <div
          className="da-chat-tab"
          data-active={tab.id === workspace.activeId}
          role="presentation"
          key={tab.id}
        >
          <button
            type="button"
            role="tab"
            id={`da-tab-${tab.id}`}
            aria-controls={`da-session-${tab.id}`}
            aria-selected={tab.id === workspace.activeId}
            tabIndex={tab.id === workspace.activeId ? 0 : -1}
            title={tab.title}
            onClick={() => select(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "Delete") {
                event.preventDefault();
                close(tab.id);
                return;
              }
              let next: ChatTab | undefined;
              switch (event.key) {
                case "ArrowRight":
                  next = workspace.tabs[(index + 1) % workspace.tabs.length];
                  break;
                case "ArrowLeft":
                  next =
                    workspace.tabs[
                      (index + workspace.tabs.length - 1) %
                        workspace.tabs.length
                    ];
                  break;
                case "Home":
                  next = workspace.tabs[0];
                  break;
                case "End":
                  next = workspace.tabs.at(-1);
                  break;
              }
              if (!next) return;
              event.preventDefault();
              select(next.id);
              document
                .getElementById(`da-tab-${next.id}`)
                ?.focus({ preventScroll: true });
            }}
          >
            {tab.status === "running" && (
              <span
                className="da-tab-running"
                role="img"
                aria-label="Response in progress"
              />
            )}
            <span>{tab.title}</span>
          </button>
          <button
            type="button"
            className="da-tab-close"
            aria-label={`Close ${tab.title}`}
            title="Close tab"
            onClick={() => close(tab.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
