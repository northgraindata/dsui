import { describe, expect, test } from "bun:test";
import { extractPrimitiveDoc } from "./primitive-catalog";

describe("extractPrimitiveDoc", () => {
  test("extracts the component id and required props", () => {
    const source = `
      export type DemoTone = "quiet" | "loud";
      export interface DemoProps {
        label: string;
        tone?: DemoTone;
      }
      export interface DemoNode { readonly kind: "demo"; readonly props: DemoProps; }
      export const Demo = defineComponent<DemoProps, DemoNode>({
        id: "demo",
        render: (props) => ({ kind: "demo", props }),
      });
    `;

    expect(extractPrimitiveDoc("demo.ts", source)).toEqual({
      componentName: "Demo",
      id: "demo",
      propsName: "DemoProps",
      props: [
        { name: "label", required: true, type: "string" },
        { name: "tone", required: false, type: "DemoTone" },
      ],
      sourcePath: "packages/adapter-sdk/src/components/primitives/demo.ts",
      supportingTypes: [
        {
          name: "DemoTone",
          declaration: 'export type DemoTone = "quiet" | "loud";',
        },
      ],
    });
  });

  test("ignores files without a matching component export", () => {
    expect(
      extractPrimitiveDoc(
        "demo.ts",
        "export interface DemoProps { label: string }",
      ),
    ).toBeNull();
  });
});
