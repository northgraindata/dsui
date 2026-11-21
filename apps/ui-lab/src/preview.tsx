import {
  type PageNode,
  serializeNodes,
} from "@northgraindata/dsui-adapter-sdk";
import { DeclarativePageRenderer } from "@northgraindata/dsui-renderer";
import { Component, type ReactNode, useMemo, useState } from "react";
import { createClient, type Scenario } from "./fixtures";

export class PreviewBoundary extends Component<
  { children: ReactNode },
  { error?: string }
> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  render() {
    return this.state.error ? (
      <p role="alert" className="lab-error">
        Preview failed: {this.state.error}
      </p>
    ) : (
      this.props.children
    );
  }
}
export function NodePreview({
  nodes,
  scenario,
}: {
  nodes: readonly PageNode[];
  scenario: Scenario;
}) {
  const [event, setEvent] = useState("");
  const client = useMemo(() => createClient(scenario, setEvent), [scenario]);
  const document = useMemo(() => serializeNodes(nodes), [nodes]);
  return (
    <>
      <DeclarativePageRenderer client={client} nodes={document} />
      <output className="lab-events" aria-live="polite">
        {event}
      </output>
    </>
  );
}
