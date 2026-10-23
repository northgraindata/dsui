import { expect, test } from "bun:test";
import { CodeEditor } from "./primitives/code-editor";
import { serializeNodes } from "./serialize";

test("editors serialize action references and reject browser callbacks", () => {
  const [node] = serializeNodes(
    CodeEditor({
      language: "yaml",
      value: "name: app",
      path: "app.yaml",
      onChangeAction: { actionId: "edit-source" },
    }),
  );
  expect(node.props.onChangeAction).toEqual({ actionId: "edit-source" });
  expect(node.props.path).toBe("app.yaml");
  expect(() =>
    serializeNodes(
      CodeEditor({ language: "yaml", value: "", onChange: () => undefined }),
    ),
  ).toThrow("onChangeAction");
});
