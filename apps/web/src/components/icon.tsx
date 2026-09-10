import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H15v-7H9v7H3Z" />
      <path d="M9 6V3H5v6" />
    </>
  ),
  play: <path d="m7 4 14 8-14 8Z" />,
  activity: (
    <>
      <path d="M4 16V10a8 8 0 0 1 16 0v6M4 12h4v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 1-2Zm16 0h-4v7h3a2 2 0 0 0 2-2v-3a2 2 0 0 0-1-2Z" />
      <path d="M12 7v5l2 2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  sparkle: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  alert: (
    <>
      <path d="m12 3 10 18H2Z" />
      <path d="M12 9v5m0 3v.1" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11M3 14h18" />
    </>
  ),
  schema: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 8h3v3H8Zm5 5h3v3h-3ZM10 11v4h3" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 10 5-10 5L2 8Zm-9 9 9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 10h18" />
    </>
  ),
  file: (
    <>
      <path d="M5 3h9l5 5v13H5ZM14 3v6h5" />
      <path d="m11 12-3 3 3 3m2-6 3 3-3 3" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </>
  ),
  plug: <path d="M9 7v6m6-6v6M7 13h10v2a5 5 0 0 1-10 0v-2Zm5 7v2" />,
  gear: (
    <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12.5v2m0 14v2m9-9h-2M5 12H3m15.36-6.36-1.42 1.42M7.05 16.95l-1.41 1.41m12.72 0-1.42-1.41M7.05 7.05 5.64 5.64" />
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4 4" />
    </>
  ),
  command: <path d="M18 8a6 6 0 1 0 0 8M6 8a6 6 0 1 1 0 8" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  terminal: (
    <>
      <path d="m5 7 4 5-4 5M12 17h7" />
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v7c0 1.66 3.13 3 7 3s7-1.34 7-3V5m-14 7v7c0 1.66 3.13 3 7 3s7-1.34 7-3v-7" />
    </>
  ),
  folder: (
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H10l2 2h6.5A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-11Z" />
  ),
};

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.grid}
    </svg>
  );
}
