import { React } from "./react";

const widthStorageKey = "dsui.ai-agent.panel-width";

function widthBounds(viewport: number) {
  return {
    min: Math.min(320, viewport),
    max: Math.min(900, viewport > 1100 ? viewport - 360 : viewport),
  };
}

function clampWidth(width: number, viewport: number) {
  const { min, max } = widthBounds(viewport);
  return Math.round(Math.max(min, Math.min(max, width)));
}

function defaultWidth(viewport: number) {
  return clampWidth(
    viewport > 1100 ? Math.min(510, viewport * 0.38) : 510,
    viewport,
  );
}

function savedWidth(viewport: number) {
  try {
    const saved = Number(window.localStorage.getItem(widthStorageKey));
    if (Number.isFinite(saved) && saved > 0) return clampWidth(saved, viewport);
  } catch {
    // Storage can be unavailable; resizing still works for this session.
  }
  return defaultWidth(viewport);
}

function rememberWidth(width: number) {
  try {
    window.localStorage.setItem(widthStorageKey, String(width));
  } catch {
    // Persisting a layout preference is optional.
  }
}

export function usePanelResize(open: boolean) {
  const { useState, useRef, useEffect } = React;
  const [viewport, setViewport] = useState(() => window.innerWidth);
  const [width, setWidth] = useState(() => savedWidth(window.innerWidth));
  const [resizing, setResizing] = useState(false);
  const handle = useRef<HTMLHRElement>(null);
  const currentWidth = useRef(width);
  const drag = useRef<{ pointerId: number; x: number; width: number } | null>(
    null,
  );
  currentWidth.current = width;

  const updateWidth = (next: number, persist = false) => {
    const clamped = clampWidth(next, window.innerWidth);
    currentWidth.current = clamped;
    setWidth(clamped);
    if (persist) rememberWidth(clamped);
  };

  const stopResize = () => {
    const pointerId = drag.current?.pointerId;
    drag.current = null;
    setResizing(false);
    if (pointerId !== undefined && handle.current?.hasPointerCapture(pointerId))
      handle.current.releasePointerCapture(pointerId);
  };

  useEffect(() => {
    const resize = () => {
      setViewport(window.innerWidth);
      setWidth((previous) => clampWidth(previous, window.innerWidth));
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (open) return;
    const pointerId = drag.current?.pointerId;
    drag.current = null;
    setResizing(false);
    if (pointerId !== undefined && handle.current?.hasPointerCapture(pointerId))
      handle.current.releasePointerCapture(pointerId);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const property = "--dsui-workspace-panel-width";
    const style = document.body.style;
    const previous = style.getPropertyValue(property);
    style.setProperty(property, `${width}px`);
    return () => {
      if (previous) style.setProperty(property, previous);
      else style.removeProperty(property);
    };
  }, [open, width]);

  useEffect(() => {
    if (!resizing) return;
    const style = document.body.style;
    const cursor = style.cursor;
    const userSelect = style.userSelect;
    style.cursor = "ew-resize";
    style.userSelect = "none";
    const stop = () => {
      drag.current = null;
      setResizing(false);
    };
    window.addEventListener("blur", stop);
    return () => {
      style.cursor = cursor;
      style.userSelect = userSelect;
      window.removeEventListener("blur", stop);
    };
  }, [resizing]);

  const bounds = widthBounds(viewport);
  const resizeHandle = (
    <hr
      ref={handle}
      className="da-resize-handle"
      tabIndex={0}
      aria-label="Resize agent panel"
      aria-orientation="vertical"
      aria-controls="dsui-agent-panel"
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels wide`}
      title="Drag to resize · Double-click to reset"
      onPointerDown={(event) => {
        if (!open || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, width };
        setResizing(true);
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (start?.pointerId === event.pointerId)
          updateWidth(start.width + start.x - event.clientX);
      }}
      onPointerUp={(event) => {
        const start = drag.current;
        if (start?.pointerId !== event.pointerId) return;
        updateWidth(start.width + start.x - event.clientX, true);
        stopResize();
      }}
      onPointerCancel={stopResize}
      onLostPointerCapture={() => {
        if (drag.current) rememberWidth(currentWidth.current);
        stopResize();
      }}
      onDoubleClick={() => updateWidth(defaultWidth(window.innerWidth), true)}
      onKeyDown={(event) => {
        let next: number;
        switch (event.key) {
          case "ArrowLeft":
            next = width + (event.shiftKey ? 64 : 24);
            break;
          case "ArrowRight":
            next = width - (event.shiftKey ? 64 : 24);
            break;
          case "Home":
            next = bounds.min;
            break;
          case "End":
            next = bounds.max;
            break;
          default:
            return;
        }
        event.preventDefault();
        updateWidth(next, true);
      }}
    />
  );
  return { width, resizing, resizeHandle };
}
