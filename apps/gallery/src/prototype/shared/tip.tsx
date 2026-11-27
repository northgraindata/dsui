/*
 * One tooltip for dense marks. A list can hold hundreds of run squares, too
 * many to give each its own tooltip component.
 */
import { type MouseEvent, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";

export function useTip() {
  const [tip, setTip] = useState<{
    x: number;
    y: number;
    content: ReactNode;
  }>();
  return {
    show: (event: MouseEvent<Element>, content: ReactNode) => {
      const box = event.currentTarget.getBoundingClientRect();
      setTip({ x: box.left + box.width / 2, y: box.top, content });
    },
    hide: () => setTip(undefined),
    node: tip
      ? createPortal(
          <div
            className="ax-tip"
            role="tooltip"
            // Kept inside the window near either edge.
            style={{
              left: Math.min(Math.max(tip.x, 118), innerWidth - 118),
              top: tip.y - 8,
            }}
          >
            {tip.content}
          </div>,
          document.body,
        )
      : null,
  };
}
