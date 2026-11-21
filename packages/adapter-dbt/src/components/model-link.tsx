import type { ComponentClient } from "@northgraindata/dsui-adapter-sdk";
import type { ReactNode } from "react";
export function ModelLink({
  client,
  id,
  children,
  className,
  label,
}: {
  client: ComponentClient;
  id: string;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const path = `/models/${encodeURIComponent(id)}`;
  const href = client.resolveHref?.(path);
  return href ? (
    <a
      href={href}
      className={className}
      aria-label={label}
      onClick={(event) => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        client.navigate(path);
      }}
    >
      {children}
    </a>
  ) : (
    <button
      type="button"
      className={className}
      aria-label={label}
      onClick={() => client.navigate(path)}
    >
      {children}
    </button>
  );
}
