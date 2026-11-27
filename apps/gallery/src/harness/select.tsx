/**
 * Behaviour of the shared select that no adapter page exercises: forms, an
 * empty-valued option, and a native modal dialog. Open with `/?harness=select`.
 */
import { Select } from "@northgraindata/dsui-ui";
import { type FormEvent, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@northgraindata/dsui-renderer/app.css";

const STATES = [
  { value: "", label: "All states" },
  { value: "active", label: "Active" },
];
const ENGINES = [
  { value: "postgres", label: "Postgres" },
  { value: "duckdb", label: "DuckDB" },
];

function Harness() {
  const [submitted, setSubmitted] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(JSON.stringify([...new FormData(event.currentTarget)]));
  };
  return (
    <main className="grid max-w-md gap-4 p-6">
      <Select ariaLabel="State" defaultValue="" options={STATES} />
      <form className="grid gap-3" onSubmit={submit}>
        <Select ariaLabel="Engine" name="engine" required options={ENGINES} />
        <button type="submit">Save</button>
        <output data-testid="submitted">{submitted}</output>
      </form>
      <button type="button" onClick={() => dialog.current?.showModal()}>
        Open native dialog
      </button>
      <dialog ref={dialog} className="w-80 p-4">
        <Select ariaLabel="In dialog" options={ENGINES} />
      </dialog>
    </main>
  );
}

export function startSelectHarness(): void {
  const root = document.getElementById("root");
  if (root) createRoot(root).render(<Harness />);
}
