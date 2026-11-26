import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";
import {
  Component,
  type ComponentType,
  type ReactNode,
  StrictMode,
  useEffect,
  useState,
} from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { Select } from "./select";
import { Tooltip } from "./tooltip";
import "@northgraindata/dsui-renderer/app.css";

const OPTIONS = [
  { value: "analytics", label: "analytics" },
  { value: "warehouse", label: "warehouse" },
  { value: "locked", label: "locked", disabled: true },
];

function Controls({ where }: { where: string }) {
  const [value, setValue] = useState("analytics");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        ariaLabel={`Database ${where}`}
        options={OPTIONS}
        value={value}
        onValueChange={setValue}
      />
      <Select
        ariaLabel={`Ghost ${where}`}
        variant="ghost"
        size="small"
        options={OPTIONS}
        value={value}
        onValueChange={setValue}
      />
      <Tooltip label="dbt incremental model">
        <button
          type="button"
          aria-label={`Model type ${where}`}
          className="h-9 w-9 rounded-lg border border-control-border text-secondary"
        >
          ◫
        </button>
      </Tooltip>
      <output data-testid={`value-${where}`}>{value}</output>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, { error?: string }> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <p role="alert">Failed: {this.state.error}</p>
    ) : (
      this.props.children
    );
  }
}

/** Loads a built plugin bundle the way the host does. */
function Plugin({ name }: { name: string }) {
  const [Picker, setPicker] = useState<ComponentType>();
  useEffect(() => {
    void import(/* @vite-ignore */ `/spike-dist/${name}.mjs`).then((bundle) =>
      setPicker(
        () =>
          bundle.createComponents(React, ReactDOM, { Select })["spike/picker"],
      ),
    );
  }, [name]);
  return (
    <section className="grid gap-2">
      <h2 className="text-[13px] font-semibold">Plugin bundle: {name}</h2>
      <Boundary>{Picker ? <Picker /> : <p>Loading…</p>}</Boundary>
    </section>
  );
}

function Spike() {
  const plugin = new URLSearchParams(location.search).get("plugin");
  return (
    <main className="grid max-w-3xl gap-6 p-6">
      <h1 className="text-[18px] font-semibold">Radix spike</h1>
      <Controls where="page" />
      <Dialog.Root>
        <Dialog.Trigger className="h-9 w-fit rounded-lg border border-control-border px-3 text-[12px]">
          Open modal
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-shadow-soft" />
          <Dialog.Content className="fixed top-1/3 left-1/2 grid w-[min(520px,92vw)] -translate-x-1/2 gap-4 rounded-xl border border-border-strong bg-surface p-5">
            <Dialog.Title>Inside a modal</Dialog.Title>
            <Dialog.Description className="text-[12px] text-secondary">
              Escape must close an open list before it closes the modal.
            </Dialog.Description>
            <Controls where="modal" />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {plugin ? <Plugin name={plugin} /> : null}
      {/* Our pickers use "" for "the configured default"; does Radix allow it? */}
      {new URLSearchParams(location.search).has("empty") ? (
        <Boundary>
          <Select
            ariaLabel="Empty value"
            value=""
            options={[{ value: "", label: "Configured database" }]}
          />
        </Boundary>
      ) : null}
    </main>
  );
}

export function startSpike(): void {
  const root = document.getElementById("root");
  if (root)
    createRoot(root).render(
      <StrictMode>
        <Spike />
      </StrictMode>,
    );
}
