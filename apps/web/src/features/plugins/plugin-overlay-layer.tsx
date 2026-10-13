import type {
  PluginOverlayPresentation,
  PluginSlotResult,
} from "@northgraindata/dsui-plugin-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getPluginSlots } from "../../api";
import { pluginRendererClient } from "./plugin-client";
import { PluginErrorBoundary } from "./plugin-error-boundary";

type ActiveOverlay = {
  pluginId: string;
  overlayId: string;
  contribution?: PluginSlotResult;
};
type TargetRect = Pick<
  DOMRect,
  "top" | "right" | "bottom" | "left" | "width" | "height"
>;
const openEvent = "dsui:overlay-open";

function useOverlayTargetRect(active: boolean, targetId?: string) {
  const [rect, setRect] = useState<TargetRect>();
  const update = useCallback(() => {
    if (!targetId) {
      setRect(undefined);
      return;
    }
    const target = document.querySelector<HTMLElement>(
      `[data-dsui-overlay-target="${CSS.escape(targetId)}"]`,
    );
    const bounds = target?.getBoundingClientRect();
    const next = bounds
      ? {
          top: bounds.top,
          right: bounds.right,
          bottom: bounds.bottom,
          left: bounds.left,
          width: bounds.width,
          height: bounds.height,
        }
      : undefined;
    setRect((current) => {
      if (
        current &&
        next &&
        current.top === next.top &&
        current.right === next.right &&
        current.bottom === next.bottom &&
        current.left === next.left &&
        current.width === next.width &&
        current.height === next.height
      )
        return current;
      return next;
    });
  }, [targetId]);

  useEffect(() => {
    if (!active || !targetId) {
      setRect(undefined);
      return;
    }
    let scrolledTarget: HTMLElement | undefined;
    const refresh = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-dsui-overlay-target="${CSS.escape(targetId)}"]`,
      );
      if (target && target !== scrolledTarget) {
        scrolledTarget = target;
        target.scrollIntoView({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
      }
      update();
    };
    refresh();
    const interval = window.setInterval(refresh, 200);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [active, targetId, update]);
  return rect;
}

function anchoredStyle(
  presentation: PluginOverlayPresentation,
  rect: TargetRect,
  height: number,
) {
  if (presentation.mode !== "anchored") return undefined;
  const width = Math.min(360, window.innerWidth - 32);
  if (presentation.dock === "bottom-right")
    return { position: "fixed" as const, right: 16, bottom: 16, width };
  const gap = 16;
  const maxTop = Math.max(16, window.innerHeight - height - 16);
  const clampLeft = (left: number) =>
    Math.max(16, Math.min(left, window.innerWidth - width - 16));
  const clampTop = (top: number) => Math.max(16, Math.min(top, maxTop));
  const placement = presentation.placement ?? "bottom";
  let left = rect.left + (rect.width - width) / 2;
  let top = rect.bottom + gap;
  if (placement === "left" || placement === "right") {
    left = placement === "left" ? rect.left - width - gap : rect.right + gap;
    top = rect.top + (rect.height - height) / 2;
    if (left < 16 || left + width > window.innerWidth - 16) {
      left = rect.left + (rect.width - width) / 2;
      top = rect.bottom + gap;
    }
  } else if (placement === "top") top = rect.top - height - gap;
  if (top + height > window.innerHeight - 16 && rect.top >= height + gap)
    top = rect.top - height - gap;
  return {
    position: "fixed" as const,
    left: clampLeft(left),
    top: clampTop(top),
    width,
  };
}

function Spotlight({ rect, close }: { rect: TargetRect; close: () => void }) {
  const left = Math.max(0, rect.left - 6);
  const top = Math.max(0, rect.top - 6);
  const right = Math.min(window.innerWidth, rect.right + 6);
  const bottom = Math.min(window.innerHeight, rect.bottom + 6);
  return (
    <>
      {[
        { left: 0, top: 0, width: "100%", height: top },
        { left: 0, top, width: left, height: bottom - top },
        { left: right, top, right: 0, height: bottom - top },
        { left: 0, top: bottom, width: "100%", bottom: 0 },
      ].map((style) => (
        <button
          type="button"
          aria-label="Close overlay"
          tabIndex={-1}
          key={JSON.stringify(style)}
          className="pointer-events-auto fixed border-0 bg-black/55 p-0"
          style={style}
          onClick={close}
        />
      ))}
      <div
        className="pointer-events-none fixed rounded-lg border-2 border-accent shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
        style={{ left, top, width: right - left, height: bottom - top }}
      />
    </>
  );
}

function OverlayDialog({
  active,
  contribution,
  close,
  targetRect,
}: {
  active: ActiveOverlay;
  contribution?: PluginSlotResult;
  close: () => void;
  targetRect?: TargetRect;
}) {
  const panel = useRef<HTMLElement>(null);
  const previousFocus = useRef<Element | null>(null);
  const presentation = contribution?.presentation;
  const anchored = presentation?.mode === "anchored";
  const [height, setHeight] = useState(240);
  useLayoutEffect(() => {
    if (!panel.current) return;
    setHeight(panel.current.getBoundingClientRect().height);
    previousFocus.current ??= document.activeElement;
    const element = panel.current;
    panel.current.focus({ preventScroll: true });
    const observer = new ResizeObserver(() =>
      setHeight(panel.current?.getBoundingClientRect().height ?? 240),
    );
    observer.observe(panel.current);
    return () => {
      observer.disconnect();
      // Restore after the modal effect removes inertness and its focus guard.
      queueMicrotask(() => {
        if (element.isConnected || document.activeElement !== document.body)
          return;
        const target = previousFocus.current;
        if (target instanceof HTMLElement && target.isConnected)
          target.focus({ preventScroll: true });
      });
    };
  }, []);
  useLayoutEffect(() => {
    const element = panel.current;
    if (anchored || !element) return;
    const siblings = new Map<HTMLElement, boolean>();
    let branch: HTMLElement = element;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          siblings.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          "button, a[href], input, select, textarea, [tabindex]",
        ),
      ).filter(
        (item) =>
          item.tabIndex >= 0 &&
          !item.matches(":disabled") &&
          item.getClientRects().length > 0,
      );
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first || !last) {
        event.preventDefault();
        element.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === element)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === element)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !element.contains(event.target))
        element.focus();
    };
    document.addEventListener("keydown", onTab);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.removeEventListener("keydown", onTab);
      document.removeEventListener("focusin", keepFocus);
      for (const [sibling, inert] of siblings) sibling.inert = inert;
    };
  }, [anchored]);
  const label = presentation?.label ?? "Plugin overlay";
  const style =
    targetRect && presentation
      ? anchoredStyle(presentation, targetRect, height)
      : undefined;

  return (
    <div
      className={
        anchored
          ? "pointer-events-none fixed inset-0 z-[100]"
          : "fixed inset-0 z-[100] grid place-items-center bg-canvas/45 p-4 backdrop-blur-[2px]"
      }
      role="presentation"
    >
      {anchored && presentation.highlight && targetRect && (
        <Spotlight rect={targetRect} close={close} />
      )}
      <section
        ref={panel}
        tabIndex={-1}
        className={`relative max-h-[min(680px,90vh)] w-full max-w-2xl overflow-auto rounded-xl border border-border-strong bg-surface-raised p-5 shadow-2xl ${anchored ? "pointer-events-auto" : ""}`}
        style={style}
        role="dialog"
        aria-modal={!anchored}
        aria-label={label}
      >
        <header className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {label}
          </span>
          <button
            type="button"
            className="text-xs text-secondary hover:text-primary"
            onClick={close}
          >
            Close · Esc
          </button>
        </header>
        {contribution ? (
          <PluginErrorBoundary key={`${active.pluginId}/${active.overlayId}`}>
            <DeclarativePageRenderer
              nodes={contribution.nodes}
              client={pluginRendererClient(active.pluginId, (path) =>
                window.location.assign(
                  `/plugins/${encodeURIComponent(active.pluginId)}/${path.replace(/^\/+/, "")}`,
                ),
              )}
            />
          </PluginErrorBoundary>
        ) : (
          <p className="text-sm text-secondary" role="status">
            Loading overlay…
          </p>
        )}
      </section>
    </div>
  );
}

export function PluginOverlayLayer() {
  const router = useRouter();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [active, setActive] = useState<ActiveOverlay>();
  const requestId = useRef(0);
  const close = useCallback(() => {
    requestId.current += 1;
    setActive(undefined);
  }, []);
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<ActiveOverlay>).detail;
      if (!detail?.pluginId || !detail.overlayId) return;
      const currentRequest = ++requestId.current;
      setActive(
        (current) =>
          current ?? { pluginId: detail.pluginId, overlayId: detail.overlayId },
      );
      void getPluginSlots("overlay", [], {
        pluginId: detail.pluginId,
        slotIds: [detail.overlayId],
      })
        .then(({ items }) => {
          if (requestId.current !== currentRequest) return;
          const contribution = items.find(
            (item) =>
              item.pluginId === detail.pluginId &&
              item.slotId === detail.overlayId,
          );
          if (
            contribution?.presentation?.mode === "anchored" &&
            contribution.presentation.path
          ) {
            if (
              `${window.location.pathname}${window.location.search}` !==
              contribution.presentation.path
            )
              router.history.push(contribution.presentation.path);
          }
          setActive(contribution ? { ...detail, contribution } : undefined);
        })
        .catch(() => {
          if (requestId.current === currentRequest) setActive(undefined);
        });
    };
    window.addEventListener(openEvent, onOpen);
    return () => window.removeEventListener(openEvent, onOpen);
  }, [router]);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, close]);

  const contribution = active?.contribution;
  const presentation = contribution?.presentation;
  useEffect(() => {
    if (presentation?.mode !== "anchored" || !presentation.advanceOn || !active)
      return;
    const expected = presentation.advanceOn;
    const onInteraction = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          target?: string;
          event?: string;
          serviceId?: string;
          pluginId?: string;
        }>
      ).detail;
      const matchesSource = expected.serviceId
        ? detail?.serviceId === expected.serviceId
        : detail?.pluginId === (expected.pluginId ?? active.pluginId);
      if (
        detail?.target === expected.target &&
        detail.event === expected.event &&
        matchesSource
      )
        window.dispatchEvent(
          new CustomEvent(openEvent, {
            detail: { pluginId: active.pluginId, overlayId: expected.overlay },
          }),
        );
    };
    window.addEventListener("dsui:interaction", onInteraction);
    return () => window.removeEventListener("dsui:interaction", onInteraction);
  }, [active, presentation]);
  const targetId =
    presentation?.mode === "anchored" ? presentation.target : undefined;
  const targetRect = useOverlayTargetRect(Boolean(active), targetId);
  if (
    !active ||
    contribution?.error ||
    (contribution && contribution.slot !== "overlay")
  )
    return null;
  if (
    presentation?.mode === "anchored" &&
    presentation.path &&
    pathname !== new URL(presentation.path, window.location.origin).pathname
  )
    return null;
  if (!contribution || (presentation?.mode === "anchored" && !targetRect))
    return (
      <div className="fixed bottom-4 right-4 z-[100] rounded-lg border border-border-strong bg-surface-raised p-4 shadow-xl">
        <p role="status" className="text-sm text-secondary">
          Waiting for the page element…
        </p>
        <button type="button" className="mt-2 text-xs" onClick={close}>
          Close · Esc
        </button>
      </div>
    );
  return (
    <OverlayDialog
      key={`${active.pluginId}/${active.overlayId}`}
      active={active}
      contribution={contribution}
      close={close}
      targetRect={targetRect}
    />
  );
}
