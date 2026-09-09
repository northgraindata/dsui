import { cn } from "@northgraindata/dsui-ui";
import { useState } from "react";

/**
 * Service mark: renders the adapter logo supplied by the API, falling
 * back to the adapter id's initials. No per-adapter maps live here —
 * branding comes from adapter metadata (`iconUrl`), never from the UI.
 */
export function ServiceMark({
  adapter,
  logo,
  size = 26,
  variant = "contained",
}: {
  adapter: string;
  logo?: string;
  size?: number;
  variant?: "contained" | "bare";
}) {
  const [failed, setFailed] = useState(false);
  const classes = cn(
    "service-mark relative flex shrink-0 items-center justify-center",
    variant === "contained"
      ? "border border-border bg-surface-raised text-secondary"
      : "text-primary",
  );
  const style = {
    width: size,
    height: size,
  };
  if (logo && !failed)
    return (
      <span className={classes} style={style}>
        <img
          src={logo}
          alt=""
          width={size - 8}
          height={size - 8}
          loading="lazy"
          className={cn("object-contain", variant === "contained" && "p-1")}
          onError={() => setFailed(true)}
        />
      </span>
    );
  return (
    <span
      className={cn(classes, "font-mono text-[9.5px] font-semibold")}
      style={style}
    >
      {adapter.slice(0, 2).toUpperCase()}
    </span>
  );
}
