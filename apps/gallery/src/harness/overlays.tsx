/** The shared overlays on one page. Open with `/?harness=overlays`. */
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  Menu,
  notify,
  Toaster,
  Tooltip,
} from "@northgraindata/dsui-ui";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@northgraindata/dsui-renderer/app.css";

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function Harness() {
  const [log, setLog] = useState<string[]>([]);
  const record = (entry: string) => setLog((entries) => [...entries, entry]);
  const [confirm, setConfirm] = useState<"succeeds" | "fails">();
  const native = useRef<HTMLDialogElement>(null);
  const failure = () =>
    notify.error("Could not trigger DAG", {
      id: "trigger",
      description: "The scheduler did not answer.",
      action: { label: "Retry", onClick: () => record("retry") },
    });
  return (
    <main className="grid max-w-xl justify-items-start gap-4 p-6">
      <Tooltip label="dbt incremental model">
        <Button variant="secondary" size="icon" aria-label="Model type">
          ◫
        </Button>
      </Tooltip>
      <Menu
        trigger={
          <Button variant="secondary" size="icon" aria-label="More actions">
            ⋯
          </Button>
        }
        items={[
          // Listed first on purpose: the menu must still put it last.
          { label: "Delete", tone: "danger", onSelect: () => record("delete") },
          { label: "Pause", onSelect: () => record("pause") },
          { label: "Clear", onSelect: () => record("clear") },
        ]}
      />
      <Button onClick={() => setConfirm("succeeds")}>Pause DAG…</Button>
      <Button onClick={() => setConfirm("fails")}>Failing action…</Button>
      <ConfirmDialog
        open={confirm !== undefined}
        onOpenChange={(open) => !open && setConfirm(undefined)}
        title="Pause daily_revenue?"
        description="No new runs are scheduled until you unpause it."
        confirmLabel="Pause DAG"
        onConfirm={async () => {
          record("confirmed");
          await wait(600);
          if (confirm === "fails") {
            failure();
            throw new Error("failed");
          }
        }}
      />
      <Button variant="secondary" onClick={failure}>
        Show error
      </Button>
      <Button variant="secondary" onClick={() => notify.success("Run queued")}>
        Show success
      </Button>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <Button variant="secondary">Open modal</Button>
        </Dialog.Trigger>
        <DialogContent title="Edit variable">
          <Button onClick={failure}>Fail inside modal</Button>
        </DialogContent>
      </Dialog.Root>
      <Button variant="secondary" onClick={() => native.current?.showModal()}>
        Open native dialog
      </Button>
      <dialog ref={native} className="w-80 gap-3 p-4 open:grid">
        <Menu
          trigger={<Button>Dialog menu</Button>}
          items={[{ label: "Inside", onSelect: () => record("inside") }]}
        />
        <Tooltip label="Tooltip in a dialog">
          <Button>Dialog hint</Button>
        </Tooltip>
      </dialog>
      <output data-testid="log">{log.join(" ")}</output>
      <Toaster />
    </main>
  );
}

export function startOverlayHarness(): void {
  const root = document.getElementById("root");
  if (root) createRoot(root).render(<Harness />);
}
