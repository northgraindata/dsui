/** Short, 24-hour timestamp such as "Oct 30, 15:27"; "—" when unknown. */
export function formatRunTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" at ", ", ");
}
