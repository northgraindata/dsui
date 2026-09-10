const paths: Record<string, string> = {
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  copy: "M8 7H5v14h12v-3M9 3h11v14H9ZM12 3v3h5V3",
  reload: "M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5",
  unload: "M5 7v13h14V7M8 7H5V4h14v3h-3M12 15V3m-3 3 3-3 3 3",
  cloud:
    "M7 18H6a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10h-1M12 22V12m-3 3 3-3 3 3",
  "cloud-file":
    "M5 13V3h10l6 6v11h-6M15 3v7h6M3 21h8a3 3 0 0 0 0-6 4 4 0 0 0-7-1 3.5 3.5 0 0 0-1 7Z",
  "chevron-down": "m7 10 5 5 5-5",
  clock: "M12 8v5l3 2M5 5a9 9 0 1 0 7-3M3 3v5h5",
  braces: "M8 3H6v6l-3 3 3 3v6h2M16 3h2v6l3 3-3 3v6h-2",
  globe:
    "M3 12h18M12 2c-6 6-6 14 0 20 6-6 6-14 0-20ZM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  pin: "M12 22S4 14 4 9a8 8 0 0 1 16 0c0 5-8 13-8 13ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  network:
    "M5 5l7 7 7-7M12 12v8M5 19l7-7 7 7M7 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM21 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM14 21a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  play: "m7 4 14 8-14 8Z",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M18 6 6 18",
  database:
    "M5 5c0-4 14-4 14 0s-14 4-14 0Zm0 0v7c0 4 14 4 14 0V5M5 12v7c0 4 14 4 14 0v-7",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  expand:
    "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M3 3l6 6m6 6 6 6M21 3l-6 6M9 15l-6 6",
  check: "m5 12 4 4L19 6",
  format: "M8 4H4v4m12-4h4v4M4 16v4h4m8 0h4v-4M9 8h6m-6 4h4m-4 4h6",
  calendar:
    "M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  hash: "M10 3 6 21M18 3l-4 18M4 9h17M3 15h17",
  file: "M5 3h9l5 5v13H5ZM14 3v6h5M9 13h6m-6 4h6",
  chevron: "m9 5 7 7-7 7",
  table:
    "M3 9h18M9 9v12M3 15h18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1 2-2V5a2 2 0 0 1 2-2Z",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  layers: "M12 3l9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5",
  cpu: "M6 6h12v12H6zM9 2v3m6-3v3M9 19v3m6-3v3M2 9h3m-3 6h3m13-6h3m-3 6h3",
  folder:
    "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3a8 8 0 0 0-.2-1.7l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.9-1.7L14 2h-4l-.5 2.6a8 8 0 0 0-2.9 1.7l-2.4-1-2 3.4 2 1.6A8 8 0 0 0 4 12c0 .6.1 1.1.2 1.7l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.9 1.7L10 22h4l.5-2.6a8 8 0 0 0 2.9-1.7l2.4 1 2-3.4-2-1.6c.1-.6.2-1.1.2-1.7Z",
  activity: "M3 12h4l3 8 4-16 3 8h4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  terminal: "m6 7 5 5-5 5M13 17h6",
};
export function WorkbenchIcon({
  name,
  size = 16,
}: {
  name: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? paths.table} />
    </svg>
  );
}
