import { expect, test } from "bun:test";
import { Glob } from "bun";
import { BUILTIN_COMPONENT_IDS } from "./registry";

/** Rendered by the renderer, or without a browser view yet. */
const NOT_IN_SDK_REGISTRY = ["chart", "code-editor"];

test("every primitive the SDK exposes has a registered view", async () => {
  const declared: string[] = [];
  const primitives = new Glob("*.ts").scan(`${import.meta.dir}/../primitives`);
  for await (const file of primitives) {
    const source = await Bun.file(
      `${import.meta.dir}/../primitives/${file}`,
    ).text();
    for (const [, id] of source.matchAll(
      /defineComponent<[\s\S]*?\{\s*id: "([a-z-]+)"/g,
    ))
      declared.push(id ?? "");
  }
  const registered: readonly string[] = BUILTIN_COMPONENT_IDS;
  expect(declared.length).toBeGreaterThan(25);
  expect(
    declared.filter(
      (id) => !registered.includes(id) && !NOT_IN_SDK_REGISTRY.includes(id),
    ),
  ).toEqual([]);
});
