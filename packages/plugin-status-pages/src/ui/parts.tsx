import type { ComponentProps } from "@northgraindata/dsui-adapter-sdk";
import type { ReactNode } from "react";
import { React } from "../react";

type Client = ComponentProps["client"];

/** An in-app link that navigates without reloading the page. */
export function PageLink({
  client,
  to,
  className,
  children,
}: {
  client: Client;
  /** Path relative to the plugin, e.g. `status-pages/example`. */
  to: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      className={className}
      href={`/plugins/status-pages/${to}`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
          return;
        event.preventDefault();
        client.navigate(to);
      }}
    >
      {children}
    </a>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "error";
  children: ReactNode;
}) {
  return (
    <p
      className="h-notice"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="h-empty">{children}</p>;
}
