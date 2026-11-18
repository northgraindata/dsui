import type { ComponentClient } from "@northgraindata/dsui-adapter-sdk";
import { useState } from "react";
import {
  buttonStyle,
  cardStyle,
  fieldStyle,
  mutedStyle,
  primaryButtonStyle,
  titleStyle,
} from "./styles.js";

export type Visibility = "private" | "public" | "password-protected";

const OPTIONS: { value: Visibility; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "Only signed-in Shaper users." },
  {
    value: "password-protected",
    label: "Password",
    hint: "Anyone with the link and the password.",
  },
  {
    value: "public",
    label: "Public",
    hint: "Anyone with the link, no password.",
  },
];

interface ShareResult {
  visibility: Visibility;
  url?: string;
  generatedPassword?: string;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={mutedStyle}>{label}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <input readOnly value={value} style={fieldStyle} aria-label={label} />
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Options({
  choice,
  onChoose,
}: {
  choice: Visibility;
  onChoose: (value: Visibility) => void;
}) {
  return (
    <div role="radiogroup" style={{ display: "grid", gap: 8 }}>
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "baseline",
            fontSize: 13,
            color: "var(--color-primary)",
          }}
        >
          <input
            type="radio"
            name="shaper-visibility"
            checked={choice === option.value}
            onChange={() => onChoose(option.value)}
          />
          <span>
            {option.label} <span style={mutedStyle}>{option.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function Outcome({ result }: { result: ShareResult }) {
  if (!result.url)
    return (
      <p style={{ ...mutedStyle, margin: 0 }}>
        This dashboard is private again.
      </p>
    );
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <CopyField label="Link" value={result.url} />
      {result.generatedPassword ? (
        <>
          <CopyField
            label="Password (shown once)"
            value={result.generatedPassword}
          />
          <span style={mutedStyle}>
            Shaper stores only a hash, so copy the password now.
          </span>
        </>
      ) : null}
    </div>
  );
}

const errorText = { ...mutedStyle, color: "var(--color-danger, #c0392b)" };

function applyLabel(busy: boolean, choice: Visibility): string {
  if (busy) return "Saving…";
  return choice === "public" ? "Make public" : "Apply";
}

/** Lets a person choose who can open a dashboard and hands back the link. */
export function SharePanel({
  client,
  id,
  visibility,
  onChanged,
  onClose,
}: {
  client: ComponentClient;
  id: string;
  visibility: Visibility;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [choice, setChoice] = useState<Visibility>(visibility);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<ShareResult>();

  const usesPassword = choice === "password-protected";
  const tooShort = usesPassword && password !== "" && password.length < 8;
  const unchanged = choice === visibility && !usesPassword;

  const apply = async () => {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const outcome = await client.executeAction({
        actionId: "share-dashboard",
        input: {
          id,
          visibility: choice,
          ...(usesPassword && password ? { password } : {}),
        },
      });
      if (outcome.status === "error") {
        setError(outcome.message ?? "Sharing failed");
        return;
      }
      setResult(outcome.data as ShareResult);
      setPassword("");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sharing failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      style={{ ...cardStyle, display: "grid", gap: 12 }}
      aria-label="Share dashboard"
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h4 style={{ ...titleStyle, margin: 0 }}>Share dashboard</h4>
        <button type="button" style={buttonStyle} onClick={onClose}>
          Close
        </button>
      </div>
      <Options choice={choice} onChoose={setChoice} />
      {usesPassword ? (
        <div style={{ display: "grid", gap: 4 }}>
          <input
            type="text"
            autoComplete="off"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave empty to generate a password"
            style={fieldStyle}
            aria-label="Share password"
          />
          {tooShort ? (
            <span style={errorText}>Use at least 8 characters.</span>
          ) : null}
        </div>
      ) : null}
      {choice === "public" ? (
        <p style={{ ...mutedStyle, margin: 0 }}>
          Anyone who has the link can see this dashboard's data.
        </p>
      ) : null}
      <div>
        <button
          type="button"
          style={primaryButtonStyle}
          disabled={busy || tooShort || unchanged}
          onClick={() => void apply()}
        >
          {applyLabel(busy, choice)}
        </button>
      </div>
      {error ? (
        <pre
          role="alert"
          style={{ ...errorText, margin: 0, whiteSpace: "pre-wrap" }}
        >
          {error}
        </pre>
      ) : null}
      {result ? <Outcome result={result} /> : null}
    </section>
  );
}
