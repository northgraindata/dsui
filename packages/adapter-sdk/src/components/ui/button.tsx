import { Button as UiButton } from "@northgraindata/dsui-ui";
import type { ActionReference } from "../../action";
import type { PageNode } from "../nodes";
import type { ButtonProps } from "../primitives/button";
import type { ComponentProps } from "../runtime";
import { WorkbenchIcon } from "./icons";

export function Button({ client, node, context }: ComponentProps) {
  const props = readProps(node);
  if (!props) return null;
  const label = resolve(props.label, context) ?? "";
  const link = resolve(props.link, context);
  const action = resolveAction(props.action, context);
  const icon = resolve(props.icon, context);
  const confirmation = resolveConfirmation(props.confirmation, context);
  return (
    <UiButton
      variant={
        props.variant === "primary"
          ? "default"
          : props.variant === "list-item"
            ? "ghost"
            : props.variant
      }
      className={props.variant === "list-item" ? "button-list-item" : undefined}
      onClick={() => {
        if (
          confirmation &&
          !window.confirm(
            `${confirmation.title}\n\n${confirmation.description}`,
          )
        )
          return;
        if (link) client.navigate(link);
        else if (action) void client.executeAction(action);
      }}
    >
      {icon ? (
        <span className="button-list-icon">
          <WorkbenchIcon name={icon} />
        </span>
      ) : null}
      <span className="button-list-text">
        <strong>{label}</strong>
        {props.description ? (
          <small className="button-list-description">
            {resolve(props.description, context)}
          </small>
        ) : null}
      </span>
      {props.kbd ? (
        <kbd className="button-list-kbd">{resolve(props.kbd, context)}</kbd>
      ) : null}
    </UiButton>
  );
}

export default Button;

function readProps(node: PageNode): ButtonProps | undefined {
  if (node.kind !== "custom") return undefined;
  return node.props.props as ButtonProps | undefined;
}

function resolve(
  value: unknown,
  context: Record<string, unknown> | undefined,
): string | undefined {
  if (typeof value === "string") return value;
  const result = resolveField(value, context);
  return result === undefined || result === null ? undefined : String(result);
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
): ActionReference | undefined {
  const result = resolveField(value, context);
  if (!isRecord(result) || typeof result.actionId !== "string")
    return undefined;
  return {
    actionId: result.actionId,
    ...(isRecord(result.input) ? { input: result.input } : {}),
  };
}

function resolveConfirmation(
  value: unknown,
  context: Record<string, unknown> | undefined,
): { title: string; description: string } | undefined {
  const result = resolveField(value, context);
  if (
    !isRecord(result) ||
    typeof result.title !== "string" ||
    typeof result.description !== "string"
  )
    return undefined;
  return { title: result.title, description: result.description };
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
