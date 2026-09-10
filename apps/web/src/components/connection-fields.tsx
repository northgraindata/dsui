import { Input } from "@northgraindata/dsui-ui";
import { useId } from "react";
import type { Field } from "../api";

export function ConnectionFields({
  fields,
  values,
  update,
  copy,
}: {
  fields: Field[];
  copy?: Record<string, { label: string; hint: string }>;
  values: Record<string, string>;
  update(key: string, value: string): void;
}) {
  const prefix = useId();
  return fields.map((field) => {
    const presentation = copy?.[field.key];
    const id = `${prefix}-${field.key}`;
    return field.type === "boolean" ? (
      <div className="connection-toggle-field" key={field.key}>
        <div>
          <label htmlFor={id}>{presentation?.label ?? field.label}</label>
          {presentation && <small id={`${id}-hint`}>{presentation.hint}</small>}
        </div>
        <input
          id={id}
          type="checkbox"
          aria-describedby={presentation ? `${id}-hint` : undefined}
          role="switch"
          aria-checked={values[field.key] === "true"}
          checked={values[field.key] === "true"}
          onChange={(event) => update(field.key, String(event.target.checked))}
        />
      </div>
    ) : (
      <div className="connection-field" key={field.key}>
        <label htmlFor={id}>
          {presentation?.label ?? field.label}
          {!field.required && (
            <span className="connection-optional"> (optional)</span>
          )}
        </label>
        {field.type === "select" ? (
          <select
            id={id}
            value={values[field.key] ?? ""}
            required={field.required}
            onChange={(event) => update(field.key, event.target.value)}
          >
            <option value="">Select…</option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
        {presentation && <small id={`${id}-hint`}>{presentation.hint}</small>}
      </div>
    );
  });
}
