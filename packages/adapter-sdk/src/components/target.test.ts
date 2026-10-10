import { expect, test } from "bun:test";
import { defineAction } from "../action";
import { Button } from "./primitives/button";
import { Target } from "./primitives/target";
import { serializeNodes } from "./serialize";

test("named targets preserve their contents and browser-safe action references across serialization", () => {
  const action = defineAction({
    id: "verify",
    run: () => ({ verified: true }),
  });
  const [node] = serializeNodes(
    Target({
      id: "example.verification",
      content: Button({
        label: "Verify",
        action: action(),
        successOverlay: "verified",
      }),
    }),
  );
  expect(node.kind).toBe("custom");
  expect(node.props.props.id).toBe("example.verification");
  expect(node.props.props.content.props.props.action).toEqual({
    actionId: "verify",
  });
  expect(node.props.props.content.props.props.successOverlay).toBe("verified");
  expect(() => JSON.stringify(node)).not.toThrow();
});
