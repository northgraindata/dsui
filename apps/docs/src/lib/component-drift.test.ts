import { describe, expect, test } from "bun:test";
import {
  type ComponentFile,
  findDrift,
  findIndexDrift,
} from "./component-drift";
import type { PrimitiveDoc } from "./primitive-catalog";

const primitive = (id: string, props: string[]): PrimitiveDoc => ({
  componentName: id,
  id,
  propsName: `${id}Props`,
  sourcePath: `${id}.ts`,
  supportingTypes: [],
  props: props.map((name) => ({
    name,
    type: "string",
    required: false,
    description: "",
  })),
});

const doc = (props: string[]): ComponentFile => ({
  name: "X",
  description: "d",
  example: "x()",
  props: Object.fromEntries(props.map((name) => [name, {}])),
});

describe("findDrift", () => {
  test("passes when docs and SDK agree", () => {
    const docs = new Map([["badge", doc(["label"])]]);
    expect(findDrift([primitive("badge", ["label", "tone"])], docs)).toEqual(
      [],
    );
  });

  test("flags a primitive without docs", () => {
    expect(findDrift([primitive("chart", [])], new Map())).toEqual([
      "chart: no docs in src/content/components/chart.json",
    ]);
  });

  test("flags docs for a removed primitive and a removed prop", () => {
    const docs = new Map([
      ["badge", doc(["gone"])],
      ["old", doc([])],
    ]);
    expect(findDrift([primitive("badge", ["label"])], docs)).toEqual([
      "badge.gone: documented prop is not in the SDK",
      "old: documented, but no such SDK primitive",
    ]);
  });
});

describe("findIndexDrift", () => {
  test("passes when every component is linked", () => {
    const index = "[A](/docs/build/components/a) [B](/docs/build/components/b)";
    expect(findIndexDrift(["a", "b"], index)).toEqual([]);
  });

  test("flags a component that the index doesn't link", () => {
    expect(findIndexDrift(["a", "b"], "[A](/docs/build/components/a)")).toEqual(
      ["b: not linked from build/components/index.mdx"],
    );
  });
});
