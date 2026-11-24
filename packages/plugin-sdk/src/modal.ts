import type * as ReactTypes from "react";

/** The part of React a modal needs. Plugins receive React from the host, so the SDK never imports it. */
export type ModalReact = Pick<
  typeof ReactTypes,
  "createElement" | "useCallback" | "useEffect" | "useId" | "useRef"
>;

export interface ModalProps {
  title: string;
  /** A muted line under the title, such as what the dialog is about. */
  subtitle?: string;
  /** Called after the exit animation, for every way of closing the dialog. */
  onClose: () => void;
  /**
   * Whether a click on the dimmed page closes the dialog. Turn it off while the
   * dialog holds input that a stray click would lose.
   */
  closeOnOutsideClick?: boolean;
  size?: "small" | "medium" | "large";
  /**
   * Whether Esc, the close button and a click outside may close the dialog. Turn
   * it off while a save is in flight; the dialog's own buttons still work.
   */
  dismissible?: boolean;
  /** The content. A function receives `close`, which closes with the exit animation. */
  children?: ModalContent;
  /**
   * Buttons that stay visible below the scrolling content. A submit button here
   * reaches a form in the content through its `form` attribute.
   */
  footer?: ModalContent;
}

/** Content, or a function of `close` for the places that dismiss the dialog themselves. */
export type ModalContent =
  | ReactTypes.ReactNode
  | ((close: () => void) => ReactTypes.ReactNode);

const EXIT_MS = 180;

const resolve = (content: ModalContent, close: () => void) =>
  typeof content === "function" ? content(close) : content;
const WIDTH = { small: 440, medium: 600, large: 820 } as const;

/**
 * Colors come from the host's theme variables, so light and dark both work. The
 * host resets element margins, which is how a native dialog centers itself, so
 * the dialog is positioned explicitly.
 */
export const MODAL_STYLES = `
.dsui-modal{position:fixed;inset:0;margin:auto;height:fit-content;padding:0;box-sizing:border-box;width:min(var(--dsui-modal-width,600px),calc(100vw - 32px));max-height:min(88vh,760px);overflow:hidden;border:1px solid var(--color-border-strong);border-radius:14px;background:var(--color-surface-raised,var(--color-surface));color:var(--color-primary);box-shadow:0 24px 64px rgb(0 0 0 / .45);font:inherit;line-height:1.5;
  opacity:0;transform:translateY(10px) scale(.98);transition:opacity 180ms ease,transform 180ms cubic-bezier(.2,.8,.2,1),overlay 180ms allow-discrete,display 180ms allow-discrete}
.dsui-modal[open]{opacity:1;transform:none}
@starting-style{.dsui-modal[open]{opacity:0;transform:translateY(10px) scale(.98)}}
.dsui-modal::backdrop{background:rgb(2 5 13 / .55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity 180ms ease,overlay 180ms allow-discrete,display 180ms allow-discrete}
.dsui-modal[open]::backdrop{opacity:1}
@starting-style{.dsui-modal[open]::backdrop{opacity:0}}
.dsui-modal-panel{display:grid;grid-template-rows:auto minmax(0,1fr) auto;max-height:inherit;min-height:0;outline:0}
.dsui-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--color-border)}
.dsui-modal-head h2{margin:0;font-size:15px;font-weight:600;line-height:1.35}
.dsui-modal-head p{margin:2px 0 0;font-size:12px;color:var(--color-muted)}
.dsui-modal-close{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:32px;height:32px;margin:-4px -6px 0 0;padding:0;border:0;border-radius:8px;background:transparent;color:var(--color-secondary);cursor:pointer;transition:background-color 140ms}
.dsui-modal-close:hover:not(:disabled){background:var(--color-surface-hover)}
.dsui-modal-close:disabled{opacity:.4;cursor:default}
.dsui-modal-close:focus-visible{outline:2px solid var(--color-accent);outline-offset:2px}
.dsui-modal-body{padding:20px;overflow:auto;min-height:0}
.dsui-modal-footer{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--color-border)}
@media (prefers-reduced-motion:reduce){.dsui-modal,.dsui-modal::backdrop{transition:none}}
`;

/**
 * Builds the shared modal dialog with the React a plugin received from the host.
 * Call it once, where the plugin stores that React:
 *
 * ```ts
 * export let Modal: ReturnType<typeof createModal>;
 * export function initializeReact(react: typeof ReactTypes) {
 *   Modal = createModal(react);
 * }
 * ```
 *
 * It is a native `<dialog>`: the browser traps focus, closes it on Esc and keeps
 * it above the page, so it needs no portal and the plugin's own styles still
 * reach its content. The page behind is dimmed and blurred, and the panel fades
 * and slides in and out. Render it only while it should be open.
 */
export function createModal(react: ModalReact) {
  const h = react.createElement;
  return function Modal(props: ModalProps): ReactTypes.ReactElement {
    const {
      title,
      subtitle,
      onClose,
      closeOnOutsideClick = true,
      size = "medium",
      dismissible = true,
      children,
      footer,
    } = props;
    const dialog = react.useRef<HTMLDialogElement>(null);
    const closing = react.useRef(false);
    const titleId = react.useId();

    react.useEffect(() => {
      const element = dialog.current;
      if (!element || element.open) return;
      element.showModal();
      // The browser focuses the first control, which would be the close button.
      // Start in the content, or on the panel when there is nothing to type into.
      const first = element.querySelector<HTMLElement>(
        ".dsui-modal-body :is(input, select, textarea)",
      );
      (first ?? element.querySelector<HTMLElement>(".dsui-modal-panel"))?.focus(
        { preventScroll: true },
      );
    }, []);

    // Closing plays the exit animation first, then tells the owner to unmount.
    const requestClose = react.useCallback(() => {
      if (closing.current) return;
      closing.current = true;
      dialog.current?.close();
      window.setTimeout(onClose, EXIT_MS);
    }, [onClose]);

    return h(
      "dialog",
      {
        ref: dialog,
        className: "dsui-modal",
        style: { "--dsui-modal-width": `${WIDTH[size]}px` },
        "aria-labelledby": titleId,
        onCancel: (event: ReactTypes.SyntheticEvent) => {
          event.preventDefault();
          if (dismissible) requestClose();
        },
        onMouseDown: (event: ReactTypes.MouseEvent) => {
          if (
            dismissible &&
            closeOnOutsideClick &&
            event.target === dialog.current
          )
            requestClose();
        },
      },
      h("style", null, MODAL_STYLES),
      h(
        "div",
        { className: "dsui-modal-panel", tabIndex: -1 },
        h(
          "header",
          { className: "dsui-modal-head" },
          h(
            "div",
            null,
            h("h2", { id: titleId }, title),
            subtitle ? h("p", null, subtitle) : null,
          ),
          h(
            "button",
            {
              type: "button",
              className: "dsui-modal-close",
              "aria-label": "Close",
              disabled: !dismissible,
              onClick: requestClose,
            },
            h(
              "svg",
              {
                width: 16,
                height: 16,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                strokeWidth: 2,
                strokeLinecap: "round",
                "aria-hidden": true,
              },
              h("path", { d: "M18 6 6 18M6 6l12 12" }),
            ),
          ),
        ),
        h(
          "div",
          { className: "dsui-modal-body" },
          resolve(children, requestClose),
        ),
        footer
          ? h(
              "footer",
              { className: "dsui-modal-footer" },
              resolve(footer, requestClose),
            )
          : null,
      ),
    );
  };
}
