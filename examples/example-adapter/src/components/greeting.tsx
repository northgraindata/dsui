import type {
  ComponentClient,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { useState } from "react";

interface GreetingProps {
  name: string;
  message?: string;
}

/**
 * A browser component receives the renderer client and its serialized
 * node. It composes primitives (or plain React) and never talks to a
 * service directly — use `client.executeAction` / `executeResource`.
 */
export default function Greeting({
  client,
  node,
}: {
  client: ComponentClient;
  node: PageNode;
}) {
  const props = (
    node.kind === "custom" ? (node.props.props ?? {}) : {}
  ) as GreetingProps;
  const [pong, setPong] = useState<string>();

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <p style={{ margin: 0 }}>
        Hello, <strong>{props.name ?? "world"}</strong>
        {props.message ? ` — ${props.message}` : ""}
      </p>
      <button
        type="button"
        style={{ marginTop: 8 }}
        onClick={async () => {
          const result = await client.executeAction({
            actionId: "ping",
            input: {},
          });
          setPong(result.status === "success" ? "pong" : "failed");
        }}
      >
        Ping
      </button>
      {pong ? <p style={{ margin: 0, marginTop: 8 }}>{pong}</p> : null}
    </div>
  );
}
