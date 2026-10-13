import type { RefObject } from "react";
import { React, ReactDOM } from "./react";
import { MAX_REPLY_SELECTION, type MessageReply } from "./replies";

type SelectedReply = {
  messageId: string;
  text: string;
  top: number;
  left: number;
};

export function useReplySelection(
  container: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  conversationId: string | undefined,
) {
  const [selection, setSelection] = React.useState<SelectedReply>();
  React.useEffect(() => {
    void conversationId;
    setSelection(undefined);
    if (!enabled) return;
    const update = () => {
      const selected = window.getSelection();
      const range = selected?.rangeCount ? selected.getRangeAt(0) : undefined;
      const element =
        range?.startContainer instanceof HTMLElement
          ? range.startContainer
          : range?.startContainer.parentElement;
      const start = element?.closest<HTMLElement>(
        "[data-reply-message-id] .da-message-text",
      );
      if (
        !range ||
        !start ||
        selected?.isCollapsed ||
        !container.current?.contains(start) ||
        !start.contains(range.endContainer)
      ) {
        setSelection(undefined);
        return;
      }
      const message = start.closest<HTMLElement>("[data-reply-message-id]");
      const text = selected?.toString().trim();
      if (!message?.dataset.replyMessageId || !text) {
        setSelection(undefined);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelection({
        messageId: message.dataset.replyMessageId,
        text,
        top: Math.max(8, rect.top - 38),
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 190)),
      });
    };
    const clear = () => setSelection(undefined);
    document.addEventListener("selectionchange", update);
    window.addEventListener("resize", clear);
    document.addEventListener("scroll", clear, true);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("resize", clear);
      document.removeEventListener("scroll", clear, true);
    };
  }, [container, enabled, conversationId]);
  return selection;
}

export function ReplySelectionAction({
  selection,
  onReply,
}: {
  selection: SelectedReply | undefined;
  onReply(messageId: string, selection: string): void;
}) {
  if (!selection) return null;
  const tooLong = selection.text.length > MAX_REPLY_SELECTION;
  return ReactDOM.createPortal(
    <button
      type="button"
      className="da-selection-reply"
      style={{ top: selection.top, left: selection.left }}
      disabled={tooLong}
      title={
        tooLong
          ? `Select up to ${MAX_REPLY_SELECTION.toLocaleString()} characters`
          : "Reply to selected text"
      }
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => onReply(selection.messageId, selection.text)}
    >
      {tooLong ? "Select a shorter excerpt" : "↩ Reply to selection"}
    </button>,
    document.body,
  );
}

export function ReplyQuote({
  reply,
  onRemove,
  onJump,
}: {
  reply: MessageReply;
  onRemove?(): void;
  onJump?(): void;
}) {
  const content = (
    <>
      <strong>
        Replying to {reply.role === "assistant" ? "DSUI Agent" : "You"}
        {reply.kind === "selection" ? " · selected text" : " · message"}
      </strong>
      <span>
        {reply.text || "Message with attachments"}
        {reply.truncated ? "…" : ""}
      </span>
    </>
  );
  return (
    <section className="da-reply-quote" aria-label="Reply context">
      {onJump ? (
        <button
          type="button"
          className="da-reply-excerpt"
          title="Jump to original message"
          onClick={onJump}
        >
          {content}
        </button>
      ) : (
        <div className="da-reply-excerpt">{content}</div>
      )}
      {onRemove && (
        <button
          type="button"
          className="da-reply-remove"
          aria-label="Cancel reply"
          title="Cancel reply"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </section>
  );
}
