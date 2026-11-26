import { expect, test } from "bun:test";
import { z } from "zod";
import { defineAction } from "../action";
import { defineResource } from "../resource";
import { Form } from "./primitives/form";
import { PageHeader } from "./primitives/page-header";
import { Stack } from "./primitives/stack";
import { serializeNodes, UnserializablePageError } from "./serialize";

const archive = defineAction({ id: "archive", run: () => ({}) });
const rows = defineResource({ id: "rows", query: () => [] });

test("bindings cross the boundary as references", () => {
  const [node] = serializeNodes({
    kind: "table",
    props: { source: rows() },
  });
  expect(node?.props.source.resourceId).toBe("rows");
  expect(node?.props.source).not.toHaveProperty("definition");
});

test("table actions are joined with their input", () => {
  const [node] = serializeNodes({
    kind: "table",
    props: {
      source: rows(),
      rowActions: [
        { label: "Archive", action: archive, input: { id: "name" } },
      ],
    },
  });
  expect(node?.props.rowActions[0]).toEqual({
    label: "Archive",
    action: { actionId: "archive", input: { id: "name" } },
  });
});

test("a single child is carried as a list", () => {
  const [node] = serializeNodes(
    Stack({ content: PageHeader({ title: "Runs" }) }),
  );
  expect(node?.props.content).toHaveLength(1);
});

test("props the author declares are never dropped", () => {
  const [node] = serializeNodes(PageHeader({ title: "Jobs", icon: "grid" }));
  expect(node?.props.icon).toBe("grid");
});

test("a form sends its action and keeps its schema on the server", () => {
  const [node] = serializeNodes(
    Form({ schema: z.object({}), onSubmit: archive }),
  );
  expect(node?.props).toEqual({
    fields: [],
    action: { actionId: "archive" },
  });
});

test("callbacks and unknown kinds are refused", () => {
  expect(() =>
    serializeNodes({ kind: "select", props: { onChange: () => undefined } }),
  ).toThrow(UnserializablePageError);
  expect(() =>
    serializeNodes({ kind: "stack", props: { content: [], gap: () => 1 } }),
  ).toThrow(UnserializablePageError);
  expect(() => serializeNodes({ kind: "nope", props: {} })).toThrow(
    "Unsupported component kind: nope",
  );
});

test("native buttons turn an action id into a reference", () => {
  const [node] = serializeNodes({
    kind: "button",
    props: { label: "Run", action: "archive" },
  });
  expect(node?.props.action).toEqual({ actionId: "archive" });
});
