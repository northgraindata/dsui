import { useEffect, useRef, useState } from "react";
import type { CodeEditorProps } from "../primitives/code-editor";
import type { ComponentProps } from "../runtime";

export default function CodeEditor({ node, client }: ComponentProps) {
  const props: CodeEditorProps = node.props;
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<{
    getValue(): string;
    setValue(value: string): void;
  } | null>(null);
  const latest = useRef({ props, client });
  latest.current = { props, client };
  const [error, setError] = useState<string>();
  const [dispatchError, setDispatchError] = useState<string>();
  const changed = (value: string) => {
    const current = latest.current;
    current.props.onChange?.(value);
    const action = current.props.onChangeAction;
    if (!action) return;
    void current.client
      .executeAction({
        ...action,
        input: {
          ...(action.input && typeof action.input === "object"
            ? action.input
            : {}),
          value,
        },
      })
      .then((result) => {
        setDispatchError(
          result.status === "error"
            ? (result.message ?? "Editor change failed")
            : undefined,
        );
      })
      .catch(() => setDispatchError("Editor change failed"));
  };
  const onChange = useRef(changed);
  onChange.current = changed;
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setError(undefined);
    void import("modern-monaco/core")
      .then(async ({ init }) => {
        const monaco = await init({ langs: [props.language] });
        if (disposed || !host.current) return;
        const model = monaco.editor.createModel(
          latest.current.props.value,
          props.language,
        );
        const instance = monaco.editor.create(host.current, {
          model,
          readOnly: props.readOnly ?? false,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 20,
          fontFamily: "var(--font-mono)",
          theme: "vs-dark",
          scrollBeyondLastLine: false,
          ariaLabel: props.path ?? "Code editor",
        });
        editor.current = instance;
        const subscription = instance.onDidChangeModelContent(() =>
          onChange.current(instance.getValue()),
        );
        cleanup = () => {
          editor.current = null;
          subscription.dispose();
          instance.dispose();
          model.dispose();
        };
      })
      .catch(() => {
        if (!disposed)
          setError(
            "Enhanced editor unavailable. Plain-text editing is available below.",
          );
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [props.language, props.path, props.readOnly]);
  useEffect(() => {
    if (editor.current && editor.current.getValue() !== props.value)
      editor.current.setValue(props.value);
  }, [props.value]);
  return (
    <div>
      {error ? (
        <>
          <p role="status">{error}</p>
          <textarea
            aria-label={props.path ?? "Code editor"}
            readOnly={props.readOnly}
            value={props.value}
            onChange={(event) => changed(event.target.value)}
            style={{
              width: "100%",
              minHeight: 420,
              fontFamily: "var(--font-mono)",
            }}
          />
        </>
      ) : (
        <div ref={host} style={{ height: "65vh", minHeight: 320 }} />
      )}
      {dispatchError && <p role="alert">{dispatchError}</p>}
    </div>
  );
}
