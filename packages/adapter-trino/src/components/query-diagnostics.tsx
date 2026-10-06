import { React } from "./react";
import {
  type Client,
  DataTable,
  Facts,
  Json,
  number,
  type ObjectValue,
  object,
  objects,
  Panel,
  text,
  useData,
} from "./shared";
export function stages(query: ObjectValue) {
  const value = query.stages;
  if (value && typeof value === "object" && !Array.isArray(value))
    return objects(object(value).stages);
  const output = query.outputStage;
  if (!output) return [];
  const visit = (stage: unknown): ObjectValue[] => {
    const value = object(stage);
    return [value, ...objects(value.subStages).flatMap(visit)];
  };
  return visit(output);
}
function PlanNode({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const node = object(value);
  if (depth > 50) return <p>Plan depth limit reached.</p>;
  const children = [
    "source",
    "filteringSource",
    "probeSource",
    "indexSource",
    "left",
    "right",
  ]
    .flatMap((key) => (node[key] ? [node[key]] : []))
    .concat(Array.isArray(node.sources) ? node.sources : []);
  return (
    <div className="tr-plan-node">
      <strong>
        {text(node["@type"] ?? node.name ?? node.type)} · {text(node.id)}
      </strong>
      {Object.entries(node)
        .filter(
          ([key, value]) =>
            ![
              "id",
              "@type",
              "sources",
              "source",
              "filteringSource",
              "probeSource",
              "indexSource",
              "left",
              "right",
            ].includes(key) && typeof value !== "object",
        )
        .map(([key, value]) => (
          <p key={key}>
            {key}: {text(value)}
          </p>
        ))}
      <div className="tr-plan-children">
        {children.map((child, index) => (
          <PlanNode
            key={text(object(child).id ?? index)}
            value={child}
            depth={depth + 1}
          />
        ))}
      </div>
    </div>
  );
}
export function LivePlan({ query }: { query: ObjectValue }) {
  return (
    <div className="tr-plan">
      {stages(query).map((stage) => (
        <Panel
          key={text(stage.stageId)}
          title={`Stage ${text(stage.stageId)} · ${text(stage.state)}`}
        >
          <Facts value={stage.stageStats} />
          <PlanNode value={object(stage.plan).root} />
        </Panel>
      ))}
    </div>
  );
}
export function Performance({
  client,
  query,
}: {
  client: Client;
  query: ObjectValue;
}) {
  return (
    <>
      {stages(query).map((stage) => (
        <Panel key={text(stage.stageId)} title={`Stage ${text(stage.stageId)}`}>
          <Facts value={stage.stageStats} />
          <h4>Operator performance</h4>
          <DataTable
            rows={objects(object(stage.stageStats).operatorSummaries)}
          />
          <h4>Tasks</h4>
          {objects(stage.tasks).map((task) => {
            const status = object(task.taskStatus);
            return (
              <details key={text(status.taskId)}>
                <summary>
                  {text(status.taskId)} · {text(status.state)} ·{" "}
                  {text(status.nodeId)}
                </summary>
                <Facts value={task.stats} />
                <Task
                  client={client}
                  nodeId={text(status.nodeId)}
                  taskId={text(status.taskId)}
                />
              </details>
            );
          })}
        </Panel>
      ))}
    </>
  );
}
function Task({
  client,
  nodeId,
  taskId,
}: {
  client: Client;
  nodeId: string;
  taskId: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setVisible((value) => !value)}>
        Worker task diagnostics
      </button>
      {visible && <TaskData client={client} nodeId={nodeId} taskId={taskId} />}
    </>
  );
}
function TaskData({
  client,
  nodeId,
  taskId,
}: {
  client: Client;
  nodeId: string;
  taskId: string;
}) {
  const result = useData(client, "monitor", { view: "task", nodeId, taskId });
  return (
    <>
      {result.error && <p className="tr-error">{result.error}</p>}
      <Json value={result.data} />
    </>
  );
}
export function duration(value: unknown): number {
  if (typeof value === "number") return value;
  const match = /^([\d.]+)\s*(ns|us|µs|ms|s|m|h|d)$/.exec(text(value));
  if (!match) return 0;
  const scales: Record<string, number> = {
    ns: 1e-6,
    us: 1e-3,
    µs: 1e-3,
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };
  return Number(match[1]) * scales[match[2]];
}
export function Timeline({
  query,
  splits = false,
}: {
  query: ObjectValue;
  splits?: boolean;
}) {
  const stats = object(query.queryStats);
  const start = Date.parse(text(stats.createTime));
  const end = Date.parse(text(stats.endTime));
  const total = Math.max(1, (Number.isFinite(end) ? end : Date.now()) - start);
  const phases = [
    "queuedTime",
    "analysisTime",
    "planningTime",
    "executionTime",
    "finishingTime",
  ];
  let offset = 0;
  const entries = splits
    ? stages(query).flatMap((stage) =>
        objects(stage.tasks).map((task) => {
          const taskStats = object(task.stats);
          const first = Date.parse(text(taskStats.firstStartTime));
          const last = Date.parse(text(taskStats.endTime));
          return {
            name: text(object(task.taskStatus).taskId),
            offset: Number.isFinite(first) ? Math.max(0, first - start) : 0,
            length:
              Number.isFinite(last) && Number.isFinite(first)
                ? Math.max(0, last - first)
                : duration(taskStats.elapsedTime),
            details: taskStats,
          };
        }),
      )
    : phases.map((name) => {
        const length = duration(stats[name]);
        const entry = {
          name,
          offset,
          length,
          details: { duration: stats[name] },
        };
        offset += length;
        return entry;
      });
  return (
    <Panel
      title={
        splits ? "Task and split execution timeline" : "Execution timeline"
      }
    >
      {entries.map((entry) => (
        <div key={entry.name} className="tr-timeline-row">
          <span>
            {entry.name}
            <small> · {(entry.length / 1000).toFixed(2)} s</small>
          </span>
          <div
            className="tr-timeline-track"
            title={`${entry.name}: ${entry.length} ms`}
          >
            <span
              className="tr-timeline-bar"
              style={{
                left: `${Math.min(100, (entry.offset / total) * 100)}%`,
                width: `${Math.min(100, (entry.length / total) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
      {splits &&
        stages(query).map((stage) => (
          <details key={text(stage.stageId)}>
            <summary>Stage {text(stage.stageId)} · split statistics</summary>
            <DataTable
              rows={objects(stage.tasks).map((task) => ({
                ...object(task.stats),
                taskId: object(task.taskStatus).taskId,
              }))}
            />
          </details>
        ))}
    </Panel>
  );
}
export function MemoryReservations({ value }: { value: unknown }) {
  const pool = object(value);
  const reservations = object(pool.queryMemoryReservations);
  return (
    <DataTable
      rows={Object.entries(reservations).map(([queryId, bytes]) => ({
        queryId,
        bytes: number(bytes),
      }))}
    />
  );
}
