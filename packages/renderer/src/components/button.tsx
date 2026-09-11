import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import type { RegistryViewProps } from "../registry/view-registry";
import { resolveActionSuccessLink } from "./table";

export function ButtonView({ client, node }: RegistryViewProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  if (node.kind !== "button") return null;
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        variant={
          node.props.variant === "primary" ? "default" : node.props.variant
        }
        disabled={busy}
        aria-busy={busy}
        title={error}
        onClick={() => {
          if (node.props.link) {
            client.navigate(node.props.link);
            return;
          }
          if (!node.props.action) return;
          setBusy(true);
          setError(undefined);
          client
            .executeAction(node.props.action)
            .then((result) => {
              if (result.status !== "success") {
                setError(result.message ?? "Action failed");
                return;
              }
              const destination = node.props.successLink
                ? resolveActionSuccessLink(node.props.successLink, result.data)
                : null;
              if (destination) client.navigate(destination);
            })
            .catch((cause) =>
              setError(
                cause instanceof Error ? cause.message : "Action failed",
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        {busy ? `${node.props.label}…` : node.props.label}
      </Button>
      {error ? (
        <span role="alert" className="text-[10px] text-unavailable">
          {error}
        </span>
      ) : null}
    </span>
  );
}
