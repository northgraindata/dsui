import chatgptLogo from "./assets/chatgpt-logo.b64" with { type: "text" };
import claudeLogo from "./assets/claude-logo.b64" with { type: "text" };
import geminiLogo from "./assets/gemini-logo.b64" with { type: "text" };
import { React } from "./react";

type ModelOption = {
  key: string;
  label: string;
  provider: string;
  id: string;
};

function modelBrand(model: ModelOption) {
  const name = `${model.provider}/${model.id}`.toLowerCase();
  if (name.includes("openai") || name.includes("gpt") || name.includes("o3"))
    return "openai";
  if (name.includes("anthropic") || name.includes("claude")) return "anthropic";
  if (name.includes("google") || name.includes("gemini")) return "gemini";
  return "generic";
}

function ModelIcon({ model }: { model: ModelOption }) {
  const brand = modelBrand(model);
  return (
    <span
      className={`da-model-icon da-model-icon--${brand}`}
      aria-hidden="true"
    >
      {brand === "openai" && (
        <img src={`data:image/png;base64,${chatgptLogo}`} alt="" />
      )}
      {brand === "anthropic" && (
        <img src={`data:image/png;base64,${claudeLogo}`} alt="" />
      )}
      {brand === "gemini" && (
        <img src={`data:image/png;base64,${geminiLogo}`} alt="" />
      )}
      {brand === "generic" && (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m12 2 8.5 5v10L12 22l-8.5-5V7L12 2Zm0 0v20M3.5 7 12 12l8.5-5M3.5 17l8.5-5 8.5 5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

function ModelOptionButton({
  model,
  selected,
  index,
  count,
  onSelect,
}: {
  model: ModelOption;
  selected: boolean;
  index: number;
  count: number;
  onSelect(): void;
}) {
  return (
    <button
      type="button"
      className="da-model-option"
      role="option"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      onKeyDown={(event) => {
        let next = index;
        if (event.key === "ArrowDown") next = (index + 1) % count;
        else if (event.key === "ArrowUp") next = (index - 1 + count) % count;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = count - 1;
        else return;
        event.preventDefault();
        event.currentTarget.parentElement
          ?.querySelectorAll<HTMLButtonElement>(".da-model-option")
          [next]?.focus({ preventScroll: true });
      }}
    >
      <ModelIcon model={model} />
      <span className="da-model-option-copy">
        <strong>{model.label}</strong>
        <small>{model.id}</small>
      </span>
      {selected && (
        <svg
          className="da-model-check"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m5 12 4 4 10-10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

export function ModelPicker({
  models,
  selectedKey,
  disabled,
  onSelect,
}: {
  models: readonly ModelOption[];
  selectedKey?: string;
  disabled: boolean;
  onSelect(key: string): void;
}) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const trigger = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();
  const selected = models.find((model) => model.key === selectedKey);

  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  React.useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", dismiss, true);
    root.current
      ?.querySelector<HTMLButtonElement>(
        ".da-model-option[aria-selected='true']",
      )
      ?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", dismiss, true);
    };
  }, [open]);

  return (
    <div className="da-model-picker" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="da-model-trigger"
        aria-label={`Agent model: ${selected?.label ?? "Model"}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        title={selected?.label ?? "Agent model"}
        disabled={disabled || !models.length}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {selected && <ModelIcon model={selected} />}
        <span className="da-model-trigger-label">
          {selected?.label ?? "Model"}
        </span>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m7 10 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          className="da-model-menu"
          id={menuId}
          role="listbox"
          aria-label="Agent model"
        >
          <div className="da-model-menu-heading">Configured models</div>
          {models.map((model, index) => (
            <ModelOptionButton
              key={model.key}
              model={model}
              selected={model.key === selectedKey}
              index={index}
              count={models.length}
              onSelect={() => {
                onSelect(model.key);
                setOpen(false);
                trigger.current?.focus({ preventScroll: true });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
