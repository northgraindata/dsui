/* The prototype's clock stands still, so every screen agrees. */
export const NOW = new Date(2026, 10, 27, 14, 0, 0);

export const ago = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000);

const two = (value: number) => String(value).padStart(2, "0");
const month = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

export const clock = (at: Date, seconds = false) =>
  `${two(at.getHours())}:${two(at.getMinutes())}${seconds ? `:${two(at.getSeconds())}` : ""}`;

export function dayLabel(at: Date) {
  const days = Math.round(
    (new Date(at).setHours(0, 0, 0, 0) - new Date(NOW).setHours(0, 0, 0, 0)) /
      86_400_000,
  );
  if (days === 0) return "Today";
  if (days === -1) return "Yesterday";
  if (days === 1) return "Tomorrow";
  const year =
    at.getFullYear() === NOW.getFullYear() ? "" : ` ${at.getFullYear()}`;
  return `${at.getDate()} ${month[at.getMonth()]}${year}`;
}

export const stamp = (at: Date) => `${dayLabel(at)} ${clock(at)}`;
export const stampSeconds = (at: Date) => `${dayLabel(at)} ${clock(at, true)}`;

export const hms = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${two(Math.floor(whole / 3600))}:${two(Math.floor(whole / 60) % 60)}:${two(whole % 60)}`;
};

export const isoDay = (at: Date) =>
  `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}`;
