import { Button, notify } from "@northgraindata/dsui-ui";
import { highlightCode } from "../../../../../packages/adapter-sdk/src/components/ui/code-block";
import { ago, type Dag, sourceOf, stampSeconds } from "./data";
import { Glyph } from "./icons";
import { Dot, Panel } from "./parts";

/** One frame: the file's facts on top, its numbered source below. */
export function Code({ dag }: { dag: Dag }) {
  const source = sourceOf(dag);
  const lines = source.split("\n").length;
  const path = `dags/${dag.owner}/${dag.id}.py`;
  return (
    <Panel flush>
      <div className="ax-code-bar">
        <Glyph name="python" size={16} />
        <code>{path}</code>
        <span className="ax-grow" />
        {/* last_parsed_time, last_parse_duration and has_import_errors */}
        <span>
          Last parsed <b>{stampSeconds(ago(0.8))}</b>
        </span>
        <span>in 0.42 s</span>
        <span className="ax-code-health">
          <Dot state="success" />
          No import errors
        </span>
        <Button
          variant="secondary"
          size="small"
          onClick={() => {
            void navigator.clipboard?.writeText(source);
            notify.success(`Copied ${path}`);
          }}
        >
          <Glyph name="copy" size={13} />
          Copy
        </Button>
      </div>
      <div className="ax-code" data-dsui-scroll>
        <pre className="ax-code-numbers" aria-hidden="true">
          {Array.from({ length: lines }, (_, index) => index + 1).join("\n")}
        </pre>
        <pre className="ax-code-source">
          <code>{highlightCode(source, "python")}</code>
        </pre>
      </div>
    </Panel>
  );
}
