import type { ActionReference } from "@northgraindata/dsui-adapter-sdk";
import { Button } from "@northgraindata/dsui-ui";
import { useState } from "react";
import type { RegistryViewProps } from "../../registry/view-registry";
import { WorkbenchIcon } from "../icons";
import {
  parseQueryResult,
  type QueryResultView,
} from "../query-editor/query-result";
import { QueryResults } from "../query-editor/results";
import { SqlEditor } from "../query-editor/sql-editor";
import { BlockHeader } from "./block-header";

export function CodeBlock({
  client,
  action,
  content,
  index,
  language,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: {
  client: RegistryViewProps["client"];
  action: ActionReference | string;
  content: string;
  index: number;
  language: string;
  onChange: (value: string) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [value, setValue] = useState(content);
  const [result, setResult] = useState<QueryResultView>();
  const [error, setError] = useState<string>();
  const [running, setRunning] = useState(false);
  const run = async () => {
    if (!value.trim() || running) return;
    setRunning(true);
    setError(undefined);
    setResult(undefined);
    try {
      const response = await client.executeAction({
        ...actionReference(action),
        input: { sql: value },
      });
      if (response.status !== "success")
        throw new Error(response.message ?? "Code execution failed");
      setResult(parseQueryResult(response.data));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Code execution failed",
      );
    } finally {
      setRunning(false);
    }
  };
  return (
    <article className="notebook-block notebook-code-block">
      <BlockHeader
        index={index}
        label={language.toUpperCase()}
        icon="braces"
        onDelete={onDelete}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
      <div className="notebook-code-toolbar">
        <span>SQL</span>
        <Button
          type="button"
          onClick={() => void run()}
          disabled={running || !value.trim()}
        >
          <WorkbenchIcon name="play" size={14} />
          {running ? "Running…" : "Run"}
        </Button>
      </div>
      <SqlEditor
        value={value}
        onChange={(nextValue) => {
          setValue(nextValue);
          onChange(nextValue);
        }}
        onRun={() => void run()}
        placeholder="Write SQL…"
      />
      {(result || error || running) && (
        <QueryResults result={result} error={error} running={running} />
      )}
    </article>
  );
}

function actionReference(value: unknown): ActionReference {
  if (!value || typeof value !== "object" || !("actionId" in value))
    return { actionId: String(value ?? "") };
  return { actionId: String((value as { actionId: string }).actionId) };
}
