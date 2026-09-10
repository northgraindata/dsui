import { expect, test } from "bun:test";
import { ActionIcon } from "./ActionIcon";

test("renders an allowlisted semantic icon as decorative SVG", () => {
  const icon = ActionIcon({ name: "play" });

  expect(icon.type).toBe("svg");
  expect(icon.props["aria-hidden"]).toBe("true");
  expect(icon.props.focusable).toBe("false");
  expect(icon.props.children).toBeDefined();
});

test("each semantic action icon has renderer-owned artwork", () => {
  for (const name of ["play", "pause", "resume", "retry", "clear"] as const) {
    expect(ActionIcon({ name }).props.children).toBeDefined();
  }
});
