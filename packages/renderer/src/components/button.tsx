import type { ActionReference } from "@northgraindata/dsui-adapter-sdk";
import { Button } from "@northgraindata/dsui-ui";
import type { RegistryViewProps } from "../registry/view-registry";
import { WorkbenchIcon } from "./icons";

export function ButtonView({ client, node, context }: RegistryViewProps) {
  if (node.kind !== "button") return null;
  const label = resolve(node.props.label, context) ?? "";
  const icon = resolve(node.props.icon, context);
  const description = resolve(node.props.description, context);
  const kbd = resolve(node.props.kbd, context);
  const link = resolve(node.props.link, context);
  const action = resolveAction(node.props.action, context);
  const confirmation = resolveConfirmation(node.props.confirmation, context);
  return (
    <Button
      variant={
        node.props.variant === "primary"
          ? "default"
          : node.props.variant === "list-item"
            ? "ghost"
            : node.props.variant
      }
      className={
        node.props.variant === "list-item" ? "button-list-item" : undefined
      }
      onClick={() => {
        if (
          confirmation &&
          !window.confirm(
            `${confirmation.title}\n\n${confirmation.description}`,
          )
        )
          return;
        if (link) client.navigate(link);
        else if (action) client.executeAction(action);
      }}
    >
      {icon && (
        <span className="button-list-icon">
          <WorkbenchIcon name={icon} size={20} />
        </span>
      )}
      <span className="button-list-text">
        <strong>{label}</strong>
        {description && (
          <small className="button-list-description">{description}</small>
        )}
      </span>
      {kbd ? (
        <kbd className="button-list-kbd">{kbd}</kbd>
      ) : node.props.variant === "list-item" ? (
        <span className="button-list-chevron" aria-hidden="true">
          →
        </span>
      ) : null}
    </Button>
  );
}

function resolveConfirmation(
  value: unknown,
  context: Record<string, unknown> | undefined,
): { title: string; description: string } | undefined {
  const resolved = resolveObject(value, context);
  if (!resolved) return undefined;
  const title = resolved.title;
  const description = resolved.description;
  return typeof title === "string" && typeof description === "string"
    ? { title, description }
    : undefined;
}

function resolve(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  const result = resolveField(value, context);
  return result === undefined || result === null ? undefined : String(result);
}

function resolveObject(
  value: unknown,
  context: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const field = value.field;
  if (typeof field !== "string") return value;
  const result = field.split(".").reduce<unknown>((current, key) => {
    if (isRecord(current)) return current[key];
    return undefined;
  }, context);
  return isRecord(result) ? result : undefined;
}

function resolveField(
  value: unknown,
  context: Record<string, unknown> | undefined,
): unknown {
  if (!isRecord(value) || typeof value.field !== "string") return value;
  return value.field.split(".").reduce<unknown>((current, key) => {
    if (isRecord(current)) return current[key];
    return undefined;
  }, context);
}

function resolveAction(
  value: unknown,
  context: Record<string, unknown> | undefined,
) {
  const result = resolveField(value, context);
  if (!isRecord(result) || typeof result.actionId !== "string")
    return undefined;
  return {
    actionId: result.actionId,
    ...(Object.hasOwn(result, "input") ? { input: result.input } : {}),
  } satisfies ActionReference;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
