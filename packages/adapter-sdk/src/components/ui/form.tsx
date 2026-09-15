import { Button, Field, Input, Surface } from "@northgraindata/dsui-ui";
import { type FormEvent, useState } from "react";
import type { ComponentProps as RegistryViewProps } from "../runtime";

type FormField = {
  kind: string;
  props: {
    name: string;
    label?: string;
    value?: string | null;
    placeholder?: string;
    secret?: boolean;
    options?: readonly { label: string; value: string }[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readFieldProps(value: unknown): FormField["props"] | null {
  if (!isRecord(value) || typeof value.name !== "string") return null;
  const options = Array.isArray(value.options)
    ? value.options.filter(
        (option): option is { label: string; value: string } =>
          isRecord(option) &&
          typeof option.label === "string" &&
          typeof option.value === "string",
      )
    : undefined;
  return {
    name: value.name,
    ...(typeof value.label === "string" ? { label: value.label } : {}),
    ...(typeof value.value === "string" || value.value === null
      ? { value: value.value }
      : {}),
    ...(typeof value.placeholder === "string"
      ? { placeholder: value.placeholder }
      : {}),
    ...(typeof value.secret === "boolean" ? { secret: value.secret } : {}),
    ...(options ? { options } : {}),
  };
}

function formField(node: unknown): FormField | null {
  if (!isRecord(node) || !isRecord(node.props)) return null;
  const props = readFieldProps(
    node.kind === "custom" ? node.props.props : node.props,
  );
  const component = node.kind === "custom" ? node.props.component : node.kind;
  if (!props || (component !== "text-input" && component !== "select"))
    return null;
  return { kind: component, props };
}

export default function ActionForm({ client, node }: RegistryViewProps) {
  const rawFields: unknown[] =
    node.kind === "form" ? [...node.props.fields] : [];
  const fields: FormField[] = rawFields
    .map(formField)
    .filter((field): field is FormField => field !== null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.flatMap((field) => {
        const value = field.props.value;
        return value == null ? [] : [[field.props.name, value]];
      }),
    ),
  );
  const [message, setMessage] = useState<string>();
  if (node.kind !== "form") return null;
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
                name={field.props.name}
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
                {field.props.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                name={field.props.name}
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
