import { expect, test } from "bun:test";
import { defineResource } from "../resource/index";
import { PageHeader, Table } from "./nodes";
import { serializeNodes, UnserializablePageError } from "./serialize";

test("serializes static page nodes and resource bindings", () => {
  const things = defineResource({ id: "things", query: () => [] });
  expect(
    serializeNodes([
      PageHeader({ title: "Things" }),
      Table({ source: things() }),
    ]),
  ).toEqual([
    { kind: "page-header", props: { title: "Things" } },
    { kind: "table", props: { source: { resourceId: "things" } } },
  ]);
});

test("rejects callbacks that cannot cross the browser boundary", () => {
  expect(() => serializeNodes(Table({ onRowClick: () => "/things" }))).toThrow(
    UnserializablePageError,
  );
});
