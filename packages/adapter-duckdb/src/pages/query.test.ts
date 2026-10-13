import { expect, test } from "bun:test";
import { serializeNodes } from "@northgraindata/dsui-adapter-sdk";
import { queryPage } from "./query";

test("query deep links fill the editor without executing SQL", () => {
  const sql = "SELECT 'paid & completed' AS status;";
  const nodes = serializeNodes(
    queryPage.render({
      params: {},
      query: new URLSearchParams({ sql }),
      stores: {
        use() {
          throw new Error("No stores expected");
        },
        get() {
          throw new Error("No stores expected");
        },
      },
    }),
  );
  const editor = nodes.find(
    (node) => node.kind === "custom" && node.props.component === "query-editor",
  );
  expect(editor?.props.props.value).toBe(sql);
  const empty = serializeNodes(
    queryPage.render({
      params: {},
      query: new URLSearchParams(),
      stores: {
        use() {
          throw new Error("No stores expected");
        },
        get() {
          throw new Error("No stores expected");
        },
      },
    }),
  );
  expect(
    empty.find(
      (node) =>
        node.kind === "custom" && node.props.component === "query-editor",
    )?.props.props.value,
  ).toBeUndefined();
});
