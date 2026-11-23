export function percent(value: number | null, digits = 2): string {
  if (value === null) return "-";
  if (value >= 100) return "100%";
  // 99.999 must not round up to a flat 100: that would claim perfection.
  const floored = Math.floor(value * 10 ** digits) / 10 ** digits;
  return `${floored.toFixed(digits)}%`;
}

function duration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function ago(time: number | null, now: number): string {
  if (time === null) return "never";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 10) return "just now";
  return `${duration(now - time)} ago`;
}

export function dateTime(time: number): string {
  return new Date(time).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const pagePath = {
  overview: "health",
};
