const paths: Record<string, string> = {
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
    "M3 9h18M9 9v12M3 15h18M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
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
