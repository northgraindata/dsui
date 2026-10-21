import { useEffect, useRef, useState } from "react";
import { useDisplayPreferences } from "../preferences";
import { HighlightedSqlInput } from "./highlighted-sql-input";

export function SqlEditor({
  value,
  onChange,
  onRun,
  placeholder,
}: {
  value: string;
  onChange(value: string): void;
  onRun(): void;
  placeholder?: string;
}) {
  const preferences = useDisplayPreferences();
  const display = useRef(preferences);
  display.current = preferences;
  const element = useRef<HTMLDivElement>(null);
  const latest = useRef({ value, onChange, onRun });
  latest.current = { value, onChange, onRun };
  const instance = useRef<{
    getValue(): string;
    setValue(value: string): void;
    updateOptions(options: {
      fontSize: number;
      wordWrap: "on" | "off";
      tabSize: number;
    }): void;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import("modern-monaco/core")
      .then(async ({ init }) => {
        const monaco = await init({
          langs: ["sql"],
          themes: [
            {
              name: "dsui",
              type: "dark",
              colors: {
                "editor.background": "#080e1b",
                "editor.foreground": "#dce5f8",
                "editorLineNumber.foreground": "#657ca1",
                "editorLineNumber.activeForeground": "#b0c1df",
                "editorCursor.foreground": "#4687ff",
                "editor.selectionBackground": "#18366a",
                "editor.lineHighlightBackground": "#0b1220",
              },
              tokenColors: [
                { scope: "keyword", settings: { foreground: "#3294ff" } },
                { scope: "string", settings: { foreground: "#dbca69" } },
                {
                  scope: "constant.numeric",
                  settings: { foreground: "#a3b989" },
                },
                { scope: "comment", settings: { foreground: "#6e85a8" } },
                {
                  scope: "support.function",
                  settings: { foreground: "#edbd54" },
                },
              ],
            },
          ],
        });
        if (disposed || !element.current) return;
        const model = monaco.editor.createModel(latest.current.value, "sql");
        const editor = monaco.editor.create(element.current, {
          model,
          automaticLayout: true,
          theme: "dsui",
          ariaLabel: "SQL query",
          fontFamily: "JetBrains Mono, ui-monospace, monospace",
          fontSize: display.current.editorFontSize,
          wordWrap: display.current.editorWordWrap ? "on" : "off",
          tabSize: display.current.editorTabSize,
          lineHeight: 20,
          lineNumbersMinChars: 3,
          minimap: { enabled: false },
          padding: { top: 8, bottom: 8 },
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          folding: false,
          glyphMargin: false,
        });
        instance.current = editor;
        const subscription = editor.onDidChangeModelContent(() =>
          latest.current.onChange(editor.getValue()),
        );
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
          latest.current.onRun(),
        );
        cleanup = () => {
          subscription.dispose();
          editor.dispose();
          model.dispose();
        };
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      instance.current = null;
      cleanup?.();
    };
  }, []);
  useEffect(() => {
    if (instance.current && instance.current.getValue() !== value)
      instance.current.setValue(value);
  }, [value]);
  useEffect(() => {
    instance.current?.updateOptions({
      fontSize: preferences.editorFontSize,
      wordWrap: preferences.editorWordWrap ? "on" : "off",
      tabSize: preferences.editorTabSize,
    });
  }, [
    preferences.editorFontSize,
    preferences.editorWordWrap,
    preferences.editorTabSize,
  ]);
  if (failed)
    return (
      <HighlightedSqlInput
        value={value}
        onChange={onChange}
        onRun={onRun}
        placeholder={placeholder}
      />
    );
  return (
    <div className="sql-editor-wrap">
      <div className="sql-editor" ref={element} />
      {placeholder && !value && (
        <div className="sql-placeholder" aria-hidden="true">
          {placeholder}
        </div>
      )}
    </div>
  );
}
