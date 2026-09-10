import { Button, Field, Input } from "@northgraindata/dsui-ui";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { login, setupOwner } from "../../api";
import { AuthFrame, authCardInput } from "../../components/auth-frame";

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await login({ email, password });
      await navigate({ to: "/" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Sign in"
      copy="Use your local workspace account to continue."
    >
      <form className={authCardInput} onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field label="Password" error={error}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="border-t border-dashed border-border px-5 py-3 text-center font-mono text-[10.5px] text-muted">
        Authentication is configured by this dsui instance.
      </p>
    </AuthFrame>
  );
}

export function SetupScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await setupOwner({ email, password });
      await navigate({ to: "/" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create owner account",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame
      title="Create the owner account"
      copy="This account administers this local dsui workspace."
    >
      <form className={authCardInput} onSubmit={submit}>
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <Field
          label="Password"
          hint="Use at least 12 characters."
          error={error}
        >
          <Input
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
    </AuthFrame>
  );
}
