import {
  Button,
  Field,
  Input,
  notify,
  Select,
  Surface,
} from "@northgraindata/dsui-ui";
import { type FormEvent, useContext, useEffect, useState } from "react";
import type { ComponentProps as RegistryViewProps } from "../runtime";
import { FormHostContext } from "./spec-dialog";
import { useAction } from "./use-action";

type FormField = {
  kind: string;
  props: {
    name: string;
    label?: string;
    value?: unknown;
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
    ...(value.value === undefined ? {} : { value: value.value }),
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

/** A field's value, read from the record in context when it is a reference. */
function initialValue(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  if (!isRecord(value) || typeof value.field !== "string") return undefined;
  const found = context?.[value.field];
  return found === undefined || found === null || found === ""
    ? undefined
    : String(found);
}

export default function ActionForm({
  client,
  node,
  context,
}: RegistryViewProps) {
  const rawFields: unknown[] =
    node.kind === "form" ? [...node.props.fields] : [];
  const fields: FormField[] = rawFields
    .map(formField)
    .filter((field): field is FormField => field !== null);
  const [initial] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.flatMap((field) => {
        const value = initialValue(field.props.value, context);
        return value === undefined ? [] : [[field.props.name, value]];
      }),
    ),
  );
  const [values, setValues] = useState(initial);
  const host = useContext(FormHostContext);
  // A form with fields has nothing to send until something differs.
  const changed =
    fields.length === 0 ||
    fields.some(
      (field) =>
        (values[field.props.name] ?? "") !== (initial[field.props.name] ?? ""),
    );
  useEffect(() => {
    host?.setDirty(changed && fields.length > 0);
  });
  const { run, pending, failed, dialog } = useAction();
  if (node.kind !== "form") return null;
  const label = node.props.submitLabel ?? "Submit";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run({
      id: `form:${node.props.action.actionId}`,
      label,
      perform: async () => {
        const result = await client.executeAction({
          ...node.props.action,
          input: values,
        });
        if (result.status !== "success")
          return result.message ?? "Action failed";
        // In a dialog the list behind it shows the result. On a page the
        // form often shows no effect of its own.
        if (host) {
          host.setDirty(false);
          host.done();
        } else notify.success(`${label}: done`);
        return undefined;
      },
    });
  };
  return (
    <Surface className={host ? "border-0 bg-transparent p-0" : "p-4"}>
      <form className="grid gap-3" onSubmit={submit}>
        {fields.map((field) => (
          <Field
            key={field.props.name}
            label={field.props.label ?? field.props.name}
          >
            {field.kind === "select" ? (
              <Select
                name={field.props.name}
                value={values[field.props.name] ?? ""}
                onValueChange={(value) =>
                  setValues({
                    ...values,
                    [field.props.name]: value,
                  })
                }
                placeholder={field.props.placeholder}
                options={field.props.options ?? []}
              />
            ) : (
              <Input
                name={field.props.name}
                type={field.props.secret ? "password" : "text"}
                value={values[field.props.name] ?? ""}
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
        <div
          className="flex justify-end gap-2 data-[page=true]:justify-start"
          data-page={!host}
        >
          {host ? (
            <Button type="button" variant="secondary" onClick={host.cancel}>
              Cancel
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={pending || !changed}
            aria-busy={pending}
            data-state={failed ? "error" : undefined}
          >
            {label}
          </Button>
        </div>
      </form>
      {dialog}
    </Surface>
  );
}
