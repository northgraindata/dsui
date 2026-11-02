import type {
  ComponentClient,
  PageNode,
} from "@northgraindata/dsui-adapter-sdk";
import { useEffect, useState } from "react";
import {
  buttonStyle,
  fieldStyle,
  mutedStyle,
  primaryButtonStyle,
} from "./styles.js";

interface EditorProps {
  type: "dashboard" | "task";
  /** Present when editing an existing app. */
  id?: string;
}

interface LoadedApp {
  name: string;
  path: string;
  content: string;
}

const TEMPLATES = {
  dashboard:
    "SELECT 'My dashboard'::SECTION;\nSELECT 'Orders'::LABEL;\nSELECT 42 AS orders;\n",
  task: "SELECT 1;\n",
} as const;

type Status = { tone: "ok" | "error" | "info"; text: string } | undefined;

export default function AppEditor({
  client,
  node,
}: {
  client: ComponentClient;
  node: PageNode;
}) {
  const props = (
    node.kind === "custom" ? (node.props.props ?? {}) : {}
  ) as EditorProps;
  const editing = props.id !== undefined;
  const [loaded, setLoaded] = useState(!editing);
  const [name, setName] = useState("");
  const [path, setPath] = useState("/");
  const [content, setContent] = useState<string>(
    editing ? "" : TEMPLATES[props.type],
  );
  const [status, setStatus] = useState<Status>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (props.id === undefined) return;
    let active = true;
    client
      .executeResource({ resourceId: "app", input: { id: props.id } })
      .then((result) => {
        if (!active) return;
        const app = result as LoadedApp;
        setName(app.name);
        setPath(app.path);
        setContent(app.content);
        setLoaded(true);
      })
      .catch((cause) => {
        if (active)
          setStatus({
            tone: "error",
            text: cause instanceof Error ? cause.message : "Could not load",
          });
      });
    return () => {
      active = false;
    };
  }, [client, props.id]);

  const run = async (actionId: string, input: unknown) => {
    setBusy(true);
    try {
      return await client.executeAction({ actionId, input });
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    setStatus({ tone: "info", text: "Validating…" });
    const result = await run("validate-dashboard", { sql: content });
    if (result.status === "error") {
      setStatus({ tone: "error", text: result.message ?? "Validation failed" });
      return;
    }
    const outcome = result.data as {
      valid: boolean;
      error?: string;
      duration: number;
    };
    setStatus(
      outcome.valid
        ? { tone: "ok", text: `Valid, evaluated in ${outcome.duration} ms` }
        : { tone: "error", text: outcome.error ?? "Invalid dashboard" },
    );
  };

  const save = async () => {
    setStatus({ tone: "info", text: "Saving…" });
    const result = editing
      ? await run("update-app", {
          id: props.id,
          type: props.type,
          name,
          path,
          content,
        })
      : await run("create-app", { type: props.type, name, path, content });
    if (result.status === "error") {
      setStatus({ tone: "error", text: result.message ?? "Save failed" });
      return;
    }
    const id = (result.data as { id: string }).id;
    setStatus({ tone: "ok", text: "Saved" });
    if (!editing) {
      client.navigate(
        props.type === "dashboard" ? `/dashboards/${id}` : `/tasks/${id}/edit`,
      );
    }
  };

  if (!loaded && !status) return <p style={mutedStyle}>Loading…</p>;
  return (
    <form
      style={{ display: "grid", gap: 14, maxWidth: 920 }}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <label style={labelStyle}>
          Name
          <input
            style={fieldStyle}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label style={labelStyle}>
          Folder
          <input
            style={fieldStyle}
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/"
          />
        </label>
      </div>
      <label style={labelStyle}>
        SQL
        <textarea
          style={{
            ...fieldStyle,
            minHeight: 360,
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.55,
            resize: "vertical",
            tabSize: 2,
          }}
          value={content}
          spellCheck={false}
          onChange={(event) => setContent(event.target.value)}
          required
        />
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="submit"
          style={primaryButtonStyle}
          disabled={busy || !name.trim() || !content.trim()}
        >
          {editing ? "Save changes" : `Create ${props.type}`}
        </button>
        {props.type === "dashboard" ? (
          <button
            type="button"
            style={buttonStyle}
            disabled={busy || !content.trim()}
            onClick={() => void validate()}
          >
            Validate
          </button>
        ) : null}
        {editing && props.type === "dashboard" ? (
          <button
            type="button"
            style={buttonStyle}
            onClick={() => client.navigate(`/dashboards/${props.id}`)}
          >
            View
          </button>
        ) : null}
        {status ? (
          <span
            role={status.tone === "error" ? "alert" : "status"}
            style={{
              fontSize: 12,
              whiteSpace: "pre-wrap",
              color:
                status.tone === "error"
                  ? "var(--color-danger-foreground)"
                  : status.tone === "ok"
                    ? "var(--color-healthy)"
                    : "var(--color-muted)",
            }}
          >
            {status.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
} as const;
