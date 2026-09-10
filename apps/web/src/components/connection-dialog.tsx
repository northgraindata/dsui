import { Button, Input } from "@northgraindata/dsui-ui";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  type Adapter,
  connectionTopEntries,
  createService,
  firstLeaf,
  type HealthStatus,
  testService,
} from "../api";
import { connectionTestMessage } from "../service-pages";
import { ConnectionAbout } from "./connection-about";
import { ConnectionFields } from "./connection-fields";
import { Icon } from "./icon";
import { ServiceMark } from "./service-mark";

type TestResult =
  | { kind: "health"; health: HealthStatus }
  | { kind: "error"; message: string };
const steps = [
  { title: "Connection", detail: "Provide connection details" },
  { title: "Test", detail: "Verify connection" },
  { title: "Finish", detail: "You're all set!" },
];

export function ConnectionDialog({
  adapter,
  onClose,
}: {
  adapter: Adapter;
  onClose(): void;
}) {
  // Provider-specific wording is editorial only; the schema still owns which
  // fields exist, their types, and their validation.
  const fieldCopy =
    adapter.id === "duckdb"
      ? {
          path: {
            label: "Database file path",
            hint: "Provide the path to your DuckDB file on the dsui server. The file will be created if it doesn’t exist.",
          },
          readOnly: {
            label: "Read-only mode",
            hint: "Open the database in read-only mode",
          },
        }
      : undefined;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLHeadingElement>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const tops = connectionTopEntries(adapter.connectionMethods);
  const [methodId, setMethodId] = useState(firstLeaf(tops[0])?.id);
  const method = adapter.connectionMethods?.find(
    (candidate) => candidate.id === methodId,
  );
  const fields = method?.fields ?? adapter.fields;
  const [values, setValues] = useState<Record<string, string>>({
    name: `My ${adapter.name}`,
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult>();
  const [saveError, setSaveError] = useState<string>();
  const [savedId, setSavedId] = useState<string>();
  const top = tops.find((entry) =>
    entry.kind === "group"
      ? entry.methods.some((candidate) => candidate.id === methodId)
      : entry.method.id === methodId,
  );
  useEffect(() => {
    alive.current = true;
    const trigger = document.activeElement;
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      alive.current = false;
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);
  useEffect(() => {
    if (step > 0) stageRef.current?.focus();
    else dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [step]);
  function chooseMethod(id: string | undefined) {
    setMethodId(id);
    setValues((previous) => ({ name: previous.name ?? "" }));
    setResult(undefined);
    setSaveError(undefined);
  }
  const update = (key: string, value: string) =>
    setValues((previous) => ({ ...previous, [key]: value }));
  function input() {
    // The display name is not part of the adapter's connection schema. Omit
    // untouched optional fields so the adapter can apply its own defaults.
    const connection = Object.fromEntries(
      fields
        .filter(
          (field) =>
            values[field.key] !== undefined && values[field.key] !== "",
        )
        .map((field) => [field.key, values[field.key]]),
    );
    return {
      adapter: adapter.id,
      name: values.name || adapter.name,
      connection: method ? { ...connection, method: method.id } : connection,
    };
  }
  async function test(event?: FormEvent) {
    event?.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setStep(1);
    setBusy(true);
    setResult(undefined);
    setSaveError(undefined);
    try {
      const health = await testService(input());
      if (alive.current) setResult({ kind: "health", health });
    } catch (cause) {
      if (alive.current)
        setResult({
          kind: "error",
          message:
            cause instanceof Error ? cause.message : "Connection test failed",
        });
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const healthy =
    result?.kind === "health" && result.health.status === "healthy";
  async function save() {
    if (pending.current || !healthy) return;
    pending.current = true;
    setBusy(true);
    setSaveError(undefined);
    try {
      const service = await createService(input());
      if (alive.current) {
        setSavedId(service.id);
        setStep(2);
      }
    } catch (cause) {
      if (alive.current)
        setSaveError(
          cause instanceof Error ? cause.message : "Could not save connection",
        );
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className="connection-dialog"
      aria-labelledby="connection-title"
      aria-describedby="connection-description"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], summary, [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) onClose();
      }}
    >
      <header className="connection-header">
        <span className="connection-brand">
          <ServiceMark
            adapter={adapter.id}
            logo={adapter.logo}
            size={50}
            variant="bare"
          />
        </span>
        <div>
          <h2 id="connection-title">Connect {adapter.name}</h2>
          <p id="connection-description">
            Set up your connection to {adapter.name}.
          </p>
        </div>
        <button
          type="button"
          className="connection-close"
          aria-label="Close connection dialog"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="connection-body">
        <nav
          className="connection-steps"
          aria-label="Connection setup progress"
        >
          <ol>
            {steps.map((item, index) => (
              <li
                key={item.title}
                aria-current={step === index ? "step" : undefined}
                data-complete={step > index}
              >
                <span className="connection-step-number">
                  {step > index ? <Icon name="check" size={15} /> : index + 1}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </div>
              </li>
            ))}
          </ol>
        </nav>
        <div className="connection-main">
          {step === 0 ? (
            <form id="connection-form" onSubmit={test}>
              {tops.length > 0 && (
                <fieldset className="connection-methods">
                  <legend>Connection type</legend>
                  <p>Choose how you want to connect to {adapter.name}.</p>
                  <div className="connection-method-grid">
                    {tops.map((entry) => {
                      const leaf = firstLeaf(entry);
                      const selected = entry === top;
                      const label =
                        entry.kind === "group"
                          ? entry.label
                          : entry.method.label;
                      const description =
                        entry.kind === "group"
                          ? entry.description
                          : entry.method.description;
                      return (
                        <label
                          className="connection-method"
                          key={
                            entry.kind === "group" ? entry.id : entry.method.id
                          }
                          data-selected={selected}
                        >
                          <input
                            type="radio"
                            name="connection-type"
                            checked={selected}
                            onChange={() => chooseMethod(leaf?.id)}
                          />
                          <Icon
                            name={
                              entry.kind === "group"
                                ? "layers"
                                : leaf?.fields.some((field) => field.required)
                                  ? "file"
                                  : "database"
                            }
                            size={21}
                          />
                          <span>
                            <strong>{label}</strong>
                            <small>{description}</small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {top?.kind === "group" && (
                <div className="connection-field">
                  <label htmlFor="connection-method">Connection method</label>
                  <select
                    id="connection-method"
                    value={methodId}
                    onChange={(event) => chooseMethod(event.target.value)}
                  >
                    {top.methods.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                  <small>{method?.description}</small>
                </div>
              )}
              <ConnectionFields
                fields={fields.filter((field) => field.required)}
                values={values}
                copy={fieldCopy}
                update={update}
              />
              <div className="connection-field">
                <label htmlFor="connection-name">Connection name</label>
                <Input
                  id="connection-name"
                  value={values.name ?? ""}
                  required
                  onChange={(event) => update("name", event.target.value)}
                />
                <small>A friendly name to identify this connection.</small>
              </div>
              {fields.some((field) => !field.required) && (
                <details className="connection-advanced" open>
                  <summary>Advanced options</summary>
                  <div>
                    <ConnectionFields
                      fields={fields.filter((field) => !field.required)}
                      values={values}
                      copy={fieldCopy}
                      update={update}
                    />
                  </div>
                </details>
              )}
            </form>
          ) : (
            <section className="connection-result" aria-busy={busy}>
              <span
                className="connection-result-icon"
                data-success={step === 2 || healthy}
              >
                <Icon
                  name={
                    step === 2 || healthy ? "check" : busy ? "plug" : "alert"
                  }
                  size={28}
                />
              </span>
              <h3 ref={stageRef} tabIndex={-1}>
                {step === 2
                  ? "You're all set!"
                  : busy
                    ? "Connecting…"
                    : healthy
                      ? "Connection successful"
                      : "Connection needs attention"}
              </h3>
              <p role="status">
                {step === 2
                  ? `${values.name} is connected and ready to use.`
                  : busy
                    ? `Verifying your connection to ${adapter.name}.`
                    : result?.kind === "health"
                      ? connectionTestMessage(result.health)
                      : result?.message}
              </p>
              {!busy && step === 1 && (
                <div className="connection-test-summary">
                  <span>
                    Connection name<strong>{values.name}</strong>
                  </span>
                  <span>
                    Adapter<strong>{adapter.name}</strong>
                  </span>
                  {method && (
                    <span>
                      Connection type<strong>{method.label}</strong>
                    </span>
                  )}
                </div>
              )}
              {saveError && (
                <p className="connection-error" role="alert">
                  {saveError}
                </p>
              )}
            </section>
          )}
        </div>
        <ConnectionAbout adapter={adapter} />
      </div>
      <footer className="connection-footer">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          {step === 2 ? "Close" : "Cancel"}
        </Button>
        <div>
          {step === 1 && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setStep(0);
                setResult(undefined);
                setSaveError(undefined);
              }}
            >
              Back
            </Button>
          )}
          {step === 0 ? (
            <Button
              type="submit"
              form="connection-form"
              className="connection-primary"
            >
              Test connection <span aria-hidden="true">→</span>
            </Button>
          ) : step === 1 ? (
            <Button
              className="connection-primary"
              disabled={busy}
              onClick={healthy ? save : () => test()}
            >
              {busy
                ? "Please wait…"
                : healthy
                  ? "Save connection"
                  : "Test again"}
              <span aria-hidden="true">→</span>
            </Button>
          ) : savedId ? (
            <Button asChild className="connection-primary">
              <Link to="/services/$serviceId" params={{ serviceId: savedId }}>
                Open connection <span aria-hidden="true">→</span>
              </Link>
            </Button>
          ) : null}
        </div>
      </footer>
    </dialog>
  );
}
