import { expect, test } from "bun:test";
import type { ComponentClient } from "@northgraindata/dsui-adapter-sdk";
import { renderToStaticMarkup } from "react-dom/server";
import { Card as CardNode } from "../../../adapter-sdk/src/components/primitives/card";
import { KeyValue as KeyValueNode } from "../../../adapter-sdk/src/components/primitives/key-value";
import { Meter as MeterNode } from "../../../adapter-sdk/src/components/primitives/meter";
import { serializeNodes } from "../../../adapter-sdk/src/components/serialize";
import KeyValue from "../../../adapter-sdk/src/components/ui/key-value";
import Card from "../../../adapter-sdk/src/components/ui/layout/card";
import Meter from "../../../adapter-sdk/src/components/ui/layout/meter";

const client: ComponentClient = {
  executeResource: async () => {
    throw new Error("Context readings must not fetch independently");
  },
  executeAction: async () => ({ status: "error" }),
  navigate: () => {
    throw new Error("Readings must not navigate");
  },
};

test("runtime details render the current resource snapshot", () => {
  const node = KeyValueNode({ title: "Runtime", field: "runtime" });
  const render = (uptime: string) =>
    renderToStaticMarkup(
      <KeyValue
        client={client}
        node={node}
        context={{ runtime: { Uptime: uptime } }}
        renderNode={() => null}
      />,
    );
  expect(render("1m")).toContain("1m");
  expect(render("2m")).toContain("2m");
});

test("volume meter renders updated capacity and severity from context", () => {
  const [node] = serializeNodes(MeterNode({ field: "meter" }));
  const render = (used: number, tone: string) =>
    renderToStaticMarkup(
      <Meter
        client={client}
        node={node}
        context={{
          meter: {
            format: "number",
            segments: [
              { label: "Used", value: used, tone },
              { label: "Available", value: 100 - used, tone: "muted" },
            ],
          },
        }}
      />,
    );
  expect(render(70, "info")).toContain("70");
  const updated = render(95, "unavailable");
  expect(updated).toContain("95");
  expect(updated).toContain("unavailable");
});

test("metric cards show the current description supplied by the resource", () => {
  const node = CardNode({
    variant: "metric",
    title: "Memory used",
    description: { field: "hint" },
  });
  const render = (hint?: string) =>
    renderToStaticMarkup(
      <Card
        client={client}
        node={node}
        context={{ hint }}
        renderNode={() => "58%"}
      />,
    );
  expect(render("9.3 GB of 16 GB")).toContain("9.3 GB of 16 GB");
  expect(render("10 GB of 16 GB")).toContain("10 GB of 16 GB");
  expect(render()).not.toContain('class="layout-card-description"');
});
