import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  Field,
  Input,
  KeyValueList,
  OptionSelect,
  Status,
  Surface,
} from "@northgraindata/dsui-ui";
import { useState } from "react";
import type { CatalogEntry, Example } from "./catalog-types";
import { columns, rows } from "./fixtures";

function SelectExample({
  empty = false,
  disabled = false,
}: {
  empty?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState("postgresql");
  return (
    <OptionSelect
      ariaLabel="Adapter"
      value={value}
      onValueChange={setValue}
      disabled={disabled}
      options={
        empty
          ? []
          : [
              { value: "postgresql", label: "PostgreSQL" },
              { value: "clickhouse", label: "ClickHouse" },
            ]
      }
    />
  );
}
function DialogExample({ open = false }: { open?: boolean }) {
  return (
    <Dialog.Root defaultOpen={open}>
      <Dialog.Trigger asChild>
        <Button variant="secondary">Open dialog</Button>
      </Dialog.Trigger>
      <DialogContent
        title="Connect a service"
        description="Local preview. No connection will be created."
      >
        <Field label="Service name">
          <Input placeholder="Analytics database" />
        </Field>
        <Dialog.Close asChild>
          <Button className="mt-4">Done</Button>
        </Dialog.Close>
      </DialogContent>
    </Dialog.Root>
  );
}
function entry(
  id: string,
  examples: Example[],
  description: string,
): CatalogEntry {
  return {
    id: `ui/${id}`,
    title: id,
    group: "UI components",
    description,
    source: `packages/ui/src/components/${id}.tsx`,
    examples,
  };
}
export const uiCatalog: CatalogEntry[] = [
  entry(
    "button",
    (["default", "secondary", "ghost", "danger"] as const).flatMap((variant) =>
      (["default", "small", "icon"] as const).flatMap((size) =>
        [false, true].map((disabled) => ({
          id: `${variant}-${size}-${disabled}`,
          title: `${variant} · ${size}${disabled ? " · disabled" : ""}`,
          render: () => (
            <Button
              variant={variant}
              size={size}
              disabled={disabled}
              aria-label={size === "icon" ? "Add service" : undefined}
            >
              {size === "icon" ? "+" : "Connect service"}
            </Button>
          ),
        })),
      ),
    ),
    "All variants, sizes and disabled states. Hover and keyboard focus remain interactive.",
  ),
  entry(
    "input",
    [
      {
        id: "default",
        title: "Empty",
        render: () => (
          <Input aria-label="Service name" placeholder="Service name" />
        ),
      },
      {
        id: "filled",
        title: "Filled",
        render: () => (
          <Input
            aria-label="Filled service name"
            defaultValue="Production warehouse"
          />
        ),
      },
      {
        id: "disabled",
        title: "Disabled",
        render: () => (
          <Input
            aria-label="Disabled service"
            disabled
            defaultValue="Read only connection"
          />
        ),
      },
      {
        id: "invalid",
        title: "Invalid",
        render: () => (
          <Input
            aria-label="Invalid service"
            aria-invalid="true"
            defaultValue="Invalid endpoint"
          />
        ),
      },
      {
        id: "secret",
        title: "Password",
        render: () => (
          <Input
            aria-label="Password"
            type="password"
            defaultValue="fixture-only"
          />
        ),
      },
      {
        id: "long",
        title: "Long value",
        render: () => (
          <Input
            aria-label="Long name"
            defaultValue={"production_".repeat(16)}
          />
        ),
      },
    ],
    "Native input states. Tab through examples to inspect the production focus ring.",
  ),
  entry(
    "field",
    [
      {
        id: "hint",
        title: "Hint",
        render: () => (
          <Field label="Endpoint" hint="Include the port">
            <Input placeholder="localhost:5432" />
          </Field>
        ),
      },
      {
        id: "error",
        title: "Validation error",
        render: () => (
          <Field label="Endpoint" error="Enter a valid hostname">
            <Input aria-invalid="true" defaultValue="https://" />
          </Field>
        ),
      },
      {
        id: "disabled",
        title: "Disabled control",
        render: () => (
          <Field label="Endpoint">
            <Input disabled defaultValue="localhost" />
          </Field>
        ),
      },
    ],
    "Label, help text and validation.",
  ),
  entry(
    "status",
    (["healthy", "warning", "unavailable", "unknown"] as const).map(
      (state) => ({
        id: state,
        title: state,
        render: () => <Status state={state} />,
      }),
    ),
    "Every supported status.",
  ),
  entry(
    "option-select",
    [
      {
        id: "selected",
        title: "Selected · open to inspect menu",
        render: () => <SelectExample />,
      },
      {
        id: "disabled",
        title: "Disabled",
        render: () => <SelectExample disabled />,
      },
      {
        id: "empty",
        title: "No options",
        render: () => <SelectExample empty />,
      },
    ],
    "Selection, keyboard navigation and empty options.",
  ),
  entry(
    "surface",
    [
      {
        id: "default",
        title: "Default",
        render: () => <Surface className="p-5">A shared surface</Surface>,
      },
      {
        id: "nested",
        title: "Nested",
        render: () => (
          <Surface className="p-5">
            <Surface className="p-5">Nested content</Surface>
          </Surface>
        ),
      },
    ],
    "Production surfaces and borders.",
  ),
  entry(
    "data-table",
    [
      {
        id: "rows",
        title: "Rows",
        render: () => <DataTable columns={columns} rows={rows} />,
      },
      {
        id: "empty",
        title: "Empty",
        render: () => <DataTable columns={columns} rows={[]} />,
      },
      {
        id: "actions",
        title: "Row actions",
        render: () => (
          <DataTable
            columns={columns}
            rows={rows}
            renderRowActions={() => <Button size="small">Inspect</Button>}
          />
        ),
      },
      {
        id: "long",
        title: "Long and missing values",
        render: () => (
          <DataTable
            columns={columns}
            rows={[
              {
                name: "very_long_table_name_".repeat(8),
                type: null,
                rows: 0,
                status: "unavailable",
              },
            ]}
          />
        ),
      },
    ],
    "Raw table component; filtering and loading are covered by the SDK Table.",
  ),
  entry(
    "key-value-list",
    [
      {
        id: "normal",
        title: "Normal",
        render: () => (
          <KeyValueList
            title="Connection"
            values={{ Adapter: "PostgreSQL", Host: "localhost", Port: 5432 }}
          />
        ),
      },
      {
        id: "empty",
        title: "Empty",
        render: () => <KeyValueList title="Connection" values={{}} />,
      },
      {
        id: "mixed",
        title: "Missing and structured data",
        render: () => (
          <KeyValueList
            values={{
              Missing: null,
              Options: { ssl: true },
              Endpoint: "long-hostname.".repeat(12),
            }}
          />
        ),
      },
    ],
    "Records, null values and wrapping.",
  ),
  entry(
    "dialog-content",
    [
      {
        id: "closed",
        title: "Closed · open to inspect focus and Escape",
        render: () => <DialogExample />,
      },
      {
        id: "open",
        title: "Open · Escape to dismiss",
        render: () => <DialogExample open />,
      },
    ],
    "Real Radix portal with close, focus trapping and keyboard dismissal. Opening is explicit so it does not obscure other examples.",
  ),
];
