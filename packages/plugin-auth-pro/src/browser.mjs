/**
 * The sign-in form.
 *
 * React comes from the host, so this file only describes markup and behaviour.
 * It talks to the plugin's own identity endpoints under `/api/auth/auth-pro`,
 * which the host mounted ahead of authentication because a logged-out browser
 * has to be able to reach them.
 */
export function createComponents(React) {
  const { useCallback, useState } = React;

  function SignIn({ node }) {
    const { basePath, registrationEnabled } = node.props.props;
    const [mode, setMode] = useState("sign-in");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(null);

    const submit = useCallback(
      async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        try {
          const response = await fetch(`${basePath}/${mode}/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Same-origin so the session cookie is stored; Better Auth sets it.
            credentials: "same-origin",
            body: JSON.stringify({ email, password }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            setError(body.message ?? "Could not sign in.");
            return;
          }
          // A full reload, not a client navigation: the server has to see the
          // new cookie before it will resolve a principal, and the plugin owns
          // where a signed-in user lands.
          window.location.assign("/");
        } catch {
          setError("Could not reach DSUI.");
        } finally {
          setPending(false);
        }
      },
      [basePath, email, mode, password],
    );

    const field = (label, type, value, onChange, autoComplete) =>
      React.createElement(
        "label",
        { className: "block space-y-1" },
        React.createElement(
          "span",
          { className: "text-[11px] text-secondary" },
          label,
        ),
        React.createElement("input", {
          type,
          value,
          autoComplete,
          required: true,
          disabled: pending,
          onChange: (event) => onChange(event.target.value),
          className:
            "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-primary outline-none focus:border-accent",
        }),
      );

    return React.createElement(
      "div",
      { className: "flex min-h-dvh items-center justify-center p-6" },
      React.createElement(
        "form",
        {
          onSubmit: submit,
          className:
            "w-full max-w-[320px] space-y-4 rounded-lg border border-line bg-surface-raised p-6",
        },
        React.createElement(
          "h1",
          { className: "text-[15px] font-medium text-primary" },
          mode === "sign-in" ? "Sign in to DSUI" : "Create your DSUI account",
        ),
        field("Email", "email", email, setEmail, "username"),
        field(
          "Password",
          "password",
          password,
          setPassword,
          "current-password",
        ),
        error
          ? React.createElement(
              "p",
              { role: "alert", className: "text-[11px] text-danger" },
              error,
            )
          : null,
        React.createElement(
          "button",
          {
            type: "submit",
            disabled: pending,
            className:
              "w-full rounded-md bg-accent px-2 py-1.5 text-[13px] text-primary-contrast disabled:opacity-60",
          },
          pending
            ? "Working…"
            : mode === "sign-in"
              ? "Sign in"
              : "Create account",
        ),
        registrationEnabled
          ? React.createElement(
              "button",
              {
                type: "button",
                onClick: () => {
                  setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                  setError(null);
                },
                className: "w-full text-[11px] text-secondary underline",
              },
              mode === "sign-in"
                ? "Create an account"
                : "I already have an account",
            )
          : null,
      ),
    );
  }

  return { "auth-pro/sign-in": SignIn };
}
