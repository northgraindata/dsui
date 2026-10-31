import { useEffect, useRef } from "react";

/**
 * Every keyboard shortcut DSUI offers. Handlers bind to these entries by id
 * and the shortcuts dialog lists them, so the two cannot drift apart.
 */

/** A key press; `mod` is ⌘ on macOS and Ctrl elsewhere. */
export type KeyCombo = {
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
  /** `KeyboardEvent.key`, lowercase for letters. */
  key?: string;
  /** `KeyboardEvent.code`, for keys whose character changes with ⌥. */
  code?: string;
  /** Text shown for the key itself. */
  label: string;
};

export type ShortcutKeys = { combos: readonly KeyCombo[] };

export type ShortcutId =
  | "search"
  | "shortcuts"
  | "sidebar"
  | "agent"
  | "close"
  | "next-tab"
  | "previous-tab"
  | "run-query";

export interface Shortcut {
  id: ShortcutId;
  group: "General" | "Adapter tabs" | "Editors";
  description: string;
  keys: ShortcutKeys;
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "search",
    group: "General",
    description: "Open search",
    keys: { combos: [{ mod: true, key: "k", label: "K" }] },
  },
  {
    id: "shortcuts",
    group: "General",
    description: "Show keyboard shortcuts",
    keys: { combos: [{ mod: true, key: "/", label: "/" }] },
  },
  {
    id: "sidebar",
    group: "General",
    description: "Collapse or expand the sidebar",
    keys: { combos: [{ mod: true, key: "b", label: "B" }] },
  },
  {
    id: "agent",
    group: "General",
    description: "Open DSUI Agent",
    keys: { combos: [{ mod: true, key: "j", label: "J" }] },
  },
  {
    id: "close",
    group: "General",
    description: "Close the open dialog or panel",
    keys: { combos: [{ key: "Escape", label: "Esc" }] },
  },
  {
    id: "next-tab",
    group: "Adapter tabs",
    description: "Next open adapter",
    keys: { combos: [{ alt: true, code: "BracketRight", label: "]" }] },
  },
  {
    id: "previous-tab",
    group: "Adapter tabs",
    description: "Previous open adapter",
    keys: { combos: [{ alt: true, code: "BracketLeft", label: "[" }] },
  },
  {
    id: "run-query",
    group: "Editors",
    description: "Run the query in a query editor",
    keys: { combos: [{ mod: true, key: "Enter", label: "Enter" }] },
  },
];

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Modifier and key labels in the order they are pressed. */
export function comboLabels(combo: KeyCombo): string[] {
  return [
    ...(combo.mod ? [isMac ? "⌘" : "Ctrl"] : []),
    ...(combo.alt ? [isMac ? "⌥" : "Alt"] : []),
    ...(combo.shift ? [isMac ? "⇧" : "Shift"] : []),
    combo.label,
  ];
}

/** First way to trigger a shortcut, as compact text for tooltips. */
export function shortcutHint(id: ShortcutId): string {
  const combo = SHORTCUTS.find((shortcut) => shortcut.id === id)?.keys
    .combos[0];
  return combo ? comboLabels(combo).join(isMac ? "" : "+") : "";
}

function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const mod = isMac ? event.metaKey : event.ctrlKey;
  if (Boolean(combo.mod) !== mod) return false;
  if (Boolean(combo.alt) !== event.altKey) return false;
  // Some layouts need Shift to type "/", so only an explicit shift is checked.
  if (combo.shift && !event.shiftKey) return false;
  if (combo.code) return event.code === combo.code;
  return event.key.toLowerCase() === combo.key?.toLowerCase();
}

/** Keys typed into a field belong to that field, not to shortcuts. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

/** Whether this key press triggers the shortcut. */
function triggers(
  shortcut: Shortcut,
  event: KeyboardEvent,
  typing: boolean,
): boolean {
  const combo = shortcut.keys.combos.find((candidate) =>
    matchesCombo(event, candidate),
  );
  return !!combo && (!typing || !!combo.mod);
}

/**
 * Binds handlers to registry entries. Shortcuts with ⌘/Ctrl work while
 * typing; plain keys only outside text fields.
 */
export function useShortcuts(
  handlers: Partial<Record<ShortcutId, () => void>>,
  enabled = true,
) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      const typing = isTyping(event.target);
      const match = SHORTCUTS.find(
        (shortcut) =>
          !!latest.current[shortcut.id] && triggers(shortcut, event, typing),
      );
      if (!match) return;
      event.preventDefault();
      latest.current[match.id]?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
