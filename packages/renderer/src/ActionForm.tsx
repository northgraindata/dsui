import type { PageNode } from "@northgraindata/dsui-core";
import { Button, Field, Input, Surface } from "@northgraindata/dsui-ui";
import { type FormEvent, useState } from "react";
import type { RendererClient } from "./types";

export function ActionForm({
  client,
  node,
}: {
  client: RendererClient;
  node: Extract<PageNode, { kind: "form" }>;
}) {
  const fields = node.props.fields.filter(
    (field) => field.kind === "text-input" || field.kind === "select",
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.flatMap((field) => {
        const value = field.props.value;
        return value == null ? [] : [[field.props.name, value]];
      }),
    ),
  );
  const [message, setMessage] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await client.executeAction({
      ...node.props.action,
      input: values,
    });
    setMessage(
      result.status === "success"
        ? "Action completed."
        : (result.message ?? "Action failed"),
    );
  };
  return (
    <Surface className="p-4">
      <form className="grid gap-3" onSubmit={submit}>
        {fields.map((field) => (
          <Field
            key={field.props.name}
            label={field.props.label ?? field.props.name}
          >
            {field.kind === "select" ? (
              <select
                className="min-h-[34px] border border-border-strong bg-background px-2.5 text-primary"
                value={values[field.props.name] ?? field.props.value ?? ""}
                onChange={(event) =>
                  setValues({
                    ...values,
                    [field.props.name]: event.target.value,
                  })
                }
              >
                {field.props.placeholder ? (
                  <option value="">{field.props.placeholder}</option>
                ) : null}
                {field.props.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={field.props.secret ? "password" : "text"}
                value={values[field.props.name] ?? field.props.value ?? ""}
                placeholder={field.props.placeholder}
                onChange={(event) =>
                  setValues({
                    ...values,
                    [field.props.name]: event.target.value,
                  })
                }
              />
            )}
          </Field>
        ))}
        <div>
          <Button type="submit">{node.props.submitLabel ?? "Submit"}</Button>
        </div>
        {message ? (
          <p role="status" className="m-0 text-[12px] text-secondary">
            {message}
          </p>
        ) : null}
      </form>
    </Surface>
  );
}
