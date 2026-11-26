import { expect, mock, test } from "bun:test";
import type { PageNode } from "@northgraindata/dsui-adapter-sdk";
import type { ReactElement } from "react";
import type { RendererClient } from "../types/renderer-types";

// Only keys are under test; the registry behind each node needs Vite's glob.
mock.module("./page-node-renderer", () => ({ PageNodeRenderer: () => null }));
const { DeclarativePageRenderer } = await import("./declarative-page-renderer");

const client: RendererClient = {
  executeResource: () => Promise.resolve(null),
  executeAction: () => Promise.resolve({ status: "success" }),
  navigate: () => undefined,
};

function keys(nodes: PageNode[]): (string | null)[] {
  const page = DeclarativePageRenderer({ client, nodes }) as ReactElement<{
    children: ReactElement[];
  }>;
  return page.props.children.map((child) => child.key);
}

test("a changed prop keeps a node's identity, so its state survives", () => {
  const before = keys([
    { kind: "page-header", props: { title: "Runs" } },
    { kind: "table", props: { pageSize: 10 } },
    { kind: "table", props: { pageSize: 10 } },
  ]);
  const after = keys([
    { kind: "page-header", props: { title: "Runs (3 active)" } },
    { kind: "table", props: { pageSize: 50 } },
    { kind: "table", props: { pageSize: 10 } },
  ]);
  expect(after).toEqual(before);
  expect(new Set(before).size).toBe(3);
});

test("a node of another kind in the same place starts fresh", () => {
  expect(keys([{ kind: "table", props: {} }])).not.toEqual(
    keys([{ kind: "chart", props: {} }]),
  );
});
