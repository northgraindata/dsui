import type { KeyboardEvent } from "react";

export function moveEntityTab(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  length: number,
  select: (index: number) => void,
) {
  const next =
    event.key === "ArrowRight"
      ? (index + 1) % length
      : event.key === "ArrowLeft"
        ? (index + length - 1) % length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? length - 1
            : undefined;
  if (next === undefined) return;
  event.preventDefault();
  select(next);
  const buttons =
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
  buttons?.[next]?.focus();
}
