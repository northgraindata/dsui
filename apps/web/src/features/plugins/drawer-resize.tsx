import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useState } from "react";

// Matches the plugin-drawer-out animation in workspace.css.
export const drawerExitMs = 220;
const drawerMinWidth = 320;
// Keep enough of the workspace visible beside a docked drawer.
const drawerWorkspaceMinWidth = 360;

function clampDrawerWidth(width: number) {
  const max = Math.max(
    drawerMinWidth,
    window.innerWidth - drawerWorkspaceMinWidth,
  );
  return Math.round(Math.min(Math.max(width, drawerMinWidth), max));
}

function readStoredDrawerWidth(key: string) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function useDrawerWidth(
  enabled: boolean,
  storageKey: string,
  defaultWidth: number,
) {
  const [width, setWidth] = useState(() =>
    clampDrawerWidth(readStoredDrawerWidth(storageKey) ?? defaultWidth),
  );
  useEffect(() => {
    if (!enabled) return;
    const onResize = () => setWidth((current) => clampDrawerWidth(current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [enabled]);
  const persist = useCallback(
    (next: number) => {
      try {
        window.localStorage.setItem(storageKey, String(next));
      } catch {
        // Width still applies for this session when storage is unavailable.
      }
    },
    [storageKey],
  );
  return { width, setWidth, persist };
}

export function DrawerResizeHandle({
  width,
  setWidth,
  persist,
}: {
  width: number;
  setWidth: (width: number) => void;
  persist: (width: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    setDragging(true);
    let latest = width;
    const onMove = (move: PointerEvent) => {
      latest = clampDrawerWidth(window.innerWidth - move.clientX);
      setWidth(latest);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setDragging(false);
      persist(latest);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16;
    let next: number | undefined;
    if (event.key === "ArrowLeft") next = width + step;
    else if (event.key === "ArrowRight") next = width - step;
    if (next === undefined) return;
    event.preventDefault();
    next = clampDrawerWidth(next);
    setWidth(next);
    persist(next);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable separator is the ARIA pattern for a resizable pane splitter
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={width}
      aria-valuemin={drawerMinWidth}
      tabIndex={0}
      className="plugin-drawer-resize"
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
