import { expect, test } from "bun:test";
import { z } from "zod";
import { defineAction } from "../action/index";
import { defineResource } from "../resource/index";
import { Button, Form, PageHeader, Table, Tabs } from "./nodes";

test("PageHeader requires a title", () => {
  expect(PageHeader({ title: "Databases" }).kind).toBe("page-header");
  expect(() => PageHeader({ title: "" })).toThrow();
});

test("Table accepts a resource binding as source", () => {
  const databases = defineResource({
    id: "databases",
    query: () => [] as string[],
  });
  const node = Table({ source: databases() });
  expect(node.kind).toBe("table");
  expect(node.props.source?.resourceId).toBe("databases");
});

test("Table supports data-driven row actions", () => {
  const suspend = defineAction({
    id: "suspend-warehouse",
    input: z.object({ warehouse: z.string() }),
    run: () => "ok",
  });
  const resume = defineAction({
    id: "resume-warehouse",
    input: z.object({ warehouse: z.string() }),
    run: () => "ok",
  });
  const node = Table<{ name: string; status: string }>({
    actions: (row) =>
      Button({
        label: row.status === "SUSPENDED" ? "Resume" : "Suspend",
        action:
          row.status === "SUSPENDED"
            ? resume({ warehouse: row.name })
            : suspend({ warehouse: row.name }),
      }),
  });
  const actions = node.props.actions?.({ name: "ETL_WH", status: "SUSPENDED" });
  expect(actions).toMatchObject({ props: { label: "Resume" } });
});

test("Tabs requires at least one item", () => {
  expect(() =>
    Tabs({
      items: [
        { label: "A", content: PageHeader({ title: "A" }) },
        { label: "B", content: [PageHeader({ title: "B" })] },
      ],
    }),
  ).not.toThrow();
  expect(() => Tabs({ items: [] })).toThrow();
});

test("Form binds a Zod schema to an action", () => {
  const input = z.object({ size: z.string() });
  const resize = defineAction({ id: "resize", input, run: () => "ok" });
  const node = Form({ schema: input, onSubmit: resize({ size: "X" }) });
  expect(node.kind).toBe("form");
  expect(node.props.onSubmit).toMatchObject({ actionId: "resize" });
});
