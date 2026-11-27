import { expect, test } from "bun:test";
import { serializeNodes } from "@northgraindata/dsui-adapter-sdk";
import { pauseDag, unpauseDag } from "./actions/dags";
import { dagDetailPage } from "./pages/dags";
import { pauseToggle } from "./resources/runs";

test("a running DAG offers only pause, a paused one only unpause", () => {
  expect<unknown>(pauseToggle("a", false)).toMatchObject({
    label: "Pause",
    action: { actionId: pauseDag.id, input: { dagId: "a" } },
    confirmation: { confirmLabel: "Pause DAG" },
  });
  expect<unknown>(pauseToggle("a", true)).toMatchObject({
    label: "Unpause",
    action: { actionId: unpauseDag.id, input: { dagId: "a" } },
    confirmation: { confirmLabel: "Unpause DAG" },
  });
});

test("header actions are named in words and follow the DAG's state", () => {
  const unused = () => {
    throw new Error("No stores expected");
  };
  const page = serializeNodes(
    dagDetailPage.render({
      params: { dagId: "a" },
      query: new URLSearchParams(),
      stores: { use: unused, get: unused },
    }),
  );
  const [header] = page[0]?.props.content ?? [];
  expect(
    header.props.actions.map(
      (action: { props: { props: { label: unknown } } }) =>
        action.props.props.label,
    ),
  ).toEqual([{ field: "pauseToggle.label" }, "Trigger"]);
});
