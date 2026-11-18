import { describe, expect, test } from "bun:test";
import { extractPrimitiveDoc } from "./primitive-catalog";

const source = `
import { defineComponent } from "../define";

export interface BadgeProps {
  /**
   * Text shown in the badge.
   *
   * Longer detail that the table skips.
   */
  label: string;
  tone?: "info" | "warning";
}

export const Badge = defineComponent<BadgeProps>({ id: "badge", path: "./ui/badge" });
`;

describe("extractPrimitiveDoc", () => {
  test("reads props, requiredness, and the first JSDoc paragraph", () => {
    const doc = extractPrimitiveDoc("badge.ts", source);
    expect(doc?.id).toBe("badge");
    expect(doc?.props).toEqual([
      {
        name: "label",
        type: "string",
        required: true,
        description: "Text shown in the badge.",
      },
      {
        name: "tone",
        type: '"info" | "warning"',
        required: false,
        description: "",
      },
    ]);
  });

  test("returns null without a props interface", () => {
    expect(extractPrimitiveDoc("none.ts", "export const None = 1;")).toBeNull();
  });
});
