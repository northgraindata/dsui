import { Input, OptionSelect, SuggestInput } from "@northgraindata/dsui-ui";
import { useId } from "react";
import type { Field, SecretProvider, SecretReference } from "../api";
import { Icon } from "./icon";
import { useSecretSuggestions } from "./use-secret-suggestions";

/**
 * Lets a field point at a secret manager instead of holding a value.
 * Offered only when a plugin provides at least one manager.
 */
export type SecretSources = {
  providers: SecretProvider[];
  /** A field present here is in secret manager mode. */
  references: Record<string, SecretReference>;
  /** Passing undefined returns the field to holding a value. */
  update(key: string, reference: SecretReference | undefined): void;
};

function SecretToggle({
  label,
  reference,
  providers,
  onChange,
}: {
  label: string;
  reference: SecretReference | undefined;
  providers: SecretProvider[];
  onChange(reference: SecretReference | undefined): void;
}) {
  return (
    <button
      type="button"
      className="connection-secret-toggle"
      aria-pressed={Boolean(reference)}
      aria-label={`Read ${label} from a secret manager`}
      title="Read from a secret manager"
      onClick={() =>
        onChange(
          reference ? undefined : { provider: providers[0].id, reference: "" },
        )
      }
    >
      <Icon name="key" size={14} />
    </button>
  );
}

function ReferenceInput({
  id,
  required,
  reference,
  providers,
  onChange,
}: {
  id: string;
  required: boolean | undefined;
  reference: SecretReference;
  providers: SecretProvider[];
  onChange(reference: SecretReference): void;
}) {
  const provider = providers.find((entry) => entry.id === reference.provider);
  const suggestions = useSecretSuggestions(provider, reference.reference);
  if (!provider)
    return (
      <small>
        The secret manager "{reference.provider}" is not set up. Turn the key
        off to enter a value.
      </small>
    );
  return (
    <>
      {providers.length > 1 && (
        <OptionSelect
          id={`${id}-provider`}
          ariaLabel="Secret manager"
          value={reference.provider}
          options={providers.map((entry) => ({
            label: entry.label,
            value: entry.id,
          }))}
          onValueChange={(value) => onChange({ ...reference, provider: value })}
        />
      )}
      {provider.searchable ? (
        <SuggestInput
          id={id}
          aria-describedby={`${id}-hint`}
          listLabel={`Secrets in ${provider.label}`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={reference.reference}
          placeholder={provider.reference.placeholder}
          required={required}
          options={suggestions.options}
          loading={suggestions.loading}
          onSuggest={suggestions.suggest}
          onValueChange={(next) => onChange({ ...reference, reference: next })}
        />
      ) : (
        <Input
          id={id}
          aria-describedby={`${id}-hint`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={reference.reference}
          placeholder={provider.reference.placeholder}
          required={required}
          onChange={(event) =>
            onChange({ ...reference, reference: event.target.value })
          }
        />
      )}
      <small id={`${id}-hint`}>
        {provider.reference.hint ??
          `${provider.reference.label} in ${provider.label}. DSUI reads it when needed and does not store the value.`}
      </small>
    </>
  );
}

export function ConnectionFields({
  fields,
  values,
  update,
  copy,
  secrets,
}: {
  fields: Field[];
  copy?: Record<string, { label: string; hint: string }>;
  values: Record<string, string>;
  update(key: string, value: string): void;
  secrets?: SecretSources;
}) {
  const prefix = useId();
  const providers = secrets?.providers ?? [];
  return fields.map((field) => {
    const presentation = copy?.[field.key];
    const id = `${prefix}-${field.key}`;
    const label = presentation?.label ?? field.label;
    // A reference resolves to text, which every adapter already accepts for
    // any field: the form sends numbers and switches as text too.
    const reference = secrets?.references[field.key];
    const toggle =
      secrets && providers.length > 0 ? (
        <SecretToggle
          label={label}
          reference={reference}
          providers={providers}
          onChange={(next) => secrets.update(field.key, next)}
        />
      ) : null;
    const referenceInput =
      secrets && reference ? (
        <ReferenceInput
          id={id}
          required={field.required}
          reference={reference}
          providers={providers}
          onChange={(next) => secrets.update(field.key, next)}
        />
      ) : null;

    if (field.type === "boolean")
      return (
        <div
          className={
            referenceInput ? "connection-field" : "connection-toggle-field"
          }
          key={field.key}
        >
          <div className="connection-field-heading">
            <div>
              <label htmlFor={id}>{label}</label>
              {presentation && !referenceInput && (
                <small id={`${id}-hint`}>{presentation.hint}</small>
              )}
            </div>
            <span className="connection-toggle-controls">
              {!referenceInput && (
                <input
                  id={id}
                  type="checkbox"
                  aria-describedby={presentation ? `${id}-hint` : undefined}
                  role="switch"
                  aria-checked={values[field.key] === "true"}
                  checked={values[field.key] === "true"}
                  onChange={(event) =>
                    update(field.key, String(event.target.checked))
                  }
                />
              )}
              {toggle}
            </span>
          </div>
          {referenceInput}
        </div>
      );

    return (
      <div className="connection-field" key={field.key}>
        <div className="connection-field-heading">
          <label htmlFor={id}>
            {label}
            {!field.required && (
              <span className="connection-optional"> (optional)</span>
            )}
          </label>
          {toggle}
        </div>
        {referenceInput ?? (
          <>
            {field.type === "select" ? (
              <OptionSelect
                id={id}
                value={values[field.key] ?? ""}
                required={field.required}
                placeholder="Select…"
                options={field.options ?? []}
                onValueChange={(value) => update(field.key, value)}
              />
            ) : (
              <Input
                id={id}
                aria-describedby={presentation ? `${id}-hint` : undefined}
                type={field.type === "list" ? "text" : (field.type ?? "text")}
                value={values[field.key] ?? ""}
                placeholder={field.placeholder}
                required={field.required}
                onChange={(event) => update(field.key, event.target.value)}
              />
            )}
            {presentation && (
              <small id={`${id}-hint`}>{presentation.hint}</small>
            )}
          </>
        )}
      </div>
    );
  });
}
