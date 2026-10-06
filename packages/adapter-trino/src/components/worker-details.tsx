import { React } from "./react";
import {
  type Client,
  ErrorMessage,
  Facts,
  Json,
  object,
  objects,
  Panel,
  text,
  useData,
} from "./shared";

export function WorkerDetails({
  client,
  nodeId,
}: {
  client: Client;
  nodeId: string;
}) {
  const status = useData(client, "monitor", { view: "worker", nodeId }, true);
  const [snapshot, setSnapshot] = React.useState<unknown>();
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const capture = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setSnapshot(
        await client.executeResource({
          resourceId: "monitor",
          input: { view: "threads", nodeId },
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not capture threads",
      );
    } finally {
      setBusy(false);
    }
  };
  const value = object(status.data);
  const memory = object(object(value.memoryInfo).pool);
  return (
    <>
      <ErrorMessage message={status.error} />
      <div className="tr-grid">
        <Panel title="Status">
          <Facts
            value={Object.fromEntries(
              Object.entries(value).filter(([key]) => key !== "memoryInfo"),
            )}
          />
        </Panel>
        <Panel title="Memory pool">
          <Facts value={memory} />
        </Panel>
      </div>
      <Panel title="Thread snapshot">
        <button type="button" onClick={() => void capture()} disabled={busy}>
          {busy ? "Capturing…" : "Capture snapshot"}
        </button>
        <ErrorMessage message={error} />
        {snapshot !== undefined &&
          objects(snapshot).map((thread) => (
            <details key={text(thread.id)}>
              <summary>
                {text(thread.name)} · {text(thread.state)}
              </summary>
              <Facts
                value={{ id: thread.id, lockOwnerId: thread.lockOwnerId }}
              />
              <Json value={thread.stackTrace} />
            </details>
          ))}
      </Panel>
    </>
  );
}
