import { cn } from "./cn";

export function Status({
  state,
  label,
}: {
  state: "healthy" | "warning" | "unavailable" | "unknown";
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-[7px] whitespace-nowrap text-[11px] lowercase text-secondary">
      <i
        aria-hidden="true"
        className={cn("size-1.5", {
          "bg-healthy": state === "healthy",
          "bg-warning": state === "warning",
          "bg-unavailable": state === "unavailable",
          "bg-unknown": state === "unknown",
        })}
      />
      {label ?? state}
    </span>
  );
}
