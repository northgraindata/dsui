import type { EntityBadge } from "@northgraindata/dsui-core";
import { WorkbenchIcon } from "../icons";

export function EntityIcon({
  name = "layers",
  size = 22,
}: {
  name?: string;
  size?: number;
}) {
  return /^https?:\/\//i.test(name) ? (
    <img src={name} alt="" width={size} height={size} />
  ) : (
    <WorkbenchIcon name={name} size={size} />
  );
}

export function Badge({
  badge,
  dot = false,
}: {
  badge: EntityBadge;
  dot?: boolean;
}) {
  return (
    <span
      className={dot ? "entity-status" : "entity-badge"}
      data-tone={badge.tone ?? "muted"}
    >
      {dot && <i aria-hidden="true" />}
      {badge.label}
    </span>
  );
}
