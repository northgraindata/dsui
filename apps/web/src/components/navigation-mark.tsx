import type { ReactNode } from "react";

const marks = {
  home: (
    <>
      <path d="m3.5 10 8.5-7 8.5 7" />
      <path d="M5.5 8.5v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-11M9.5 20.5v-7h5v7" />
    </>
  ),
  adapters: (
    <>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </>
  ),
  settings: (
    <>
      <path d="m9.5 3-.6 2.3-2 .9-2.2-.6-2.5 4.3 1.7 1.7v2.3l-1.7 1.7 2.5 4.3 2.2-.6 2 .9.6 2.3h5l.6-2.3 2-.9 2.2.6 2.5-4.3-1.7-1.7v-2.3l1.7-1.7-2.5-4.3-2.2.6-2-.9L14.5 3Z" />
      <circle cx="12" cy="12.75" r="3.25" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export function NavigationMark({ name }: { name: keyof typeof marks }) {
  return (
    <span className="navigation-mark" aria-hidden="true">
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {marks[name]}
      </svg>
    </span>
  );
}
