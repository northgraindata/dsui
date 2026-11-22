import type { TableRowAction, TableRowMenuAction } from "../primitives/table";
import type { ComponentProps } from "../runtime";

type Client = ComponentProps["client"];
type Row = Record<string, unknown>;

export function resolveLink(
  path: string,
  params: Record<string, string>,
  row: Row,
): string | null {
  let resolved = path;
  for (const [param, field] of Object.entries(params)) {
    const value = row[field];
    if (value === null || value === undefined || value === "") return null;
    resolved = resolved.replace(`:${param}`, encodeURIComponent(String(value)));
  }
  return resolved;
}

export function matchesWhen(
  row: Row,
  when: TableRowAction["when"] | TableRowAction["disabledWhen"],
): boolean {
  if (!when) return true;
  const value = row[when.field];
  if (when.equals !== undefined && value !== when.equals) return false;
  if (when.notEquals !== undefined && value === when.notEquals) return false;
  return true;
}

export function isRowActionDisabled(
  row: Row,
  when: TableRowAction["disabledWhen"],
): boolean {
  return when ? matchesWhen(row, when) : false;
}

export function actionId(
  action: TableRowAction["action"] | TableRowMenuAction["action"],
): string {
  if (!action) throw new Error("Table action is missing");
  if (typeof action === "string") return action;
  // Browser nodes carry serialized { actionId } references; raw definitions
  // carry { id }. Accept both so actions survive the server boundary.
  const reference = action as { actionId?: unknown; id?: unknown };
  if (typeof reference.actionId === "string") return reference.actionId;
  if (typeof reference.id === "string") return reference.id;
  throw new Error("Table action is missing");
}

/**
 * Follows a row action's link, or runs its action with input read from the
 * row and then its success link. Resolves to an error message on failure.
 */
export async function performRowAction(
  client: Client,
  spec: TableRowAction | TableRowMenuAction,
  row: Row,
  onSuccess?: () => void,
): Promise<string | undefined> {
  if (spec.link) {
    const href = resolveLink(spec.link.path, spec.link.params, row);
    if (href) client.navigate(href);
    return undefined;
  }
  if (!spec.action) return undefined;
  const input = Object.fromEntries(
    Object.entries(spec.input ?? {}).map(([key, field]) => [key, row[field]]),
  );
  try {
    const result = await client.executeAction({
      actionId: actionId(spec.action),
      input,
    });
    if (result.status !== "success") return result.message ?? "Action failed";
    onSuccess?.();
    if (!spec.successLink) return undefined;
    const resultData =
      result.data && typeof result.data === "object"
        ? (result.data as Row)
        : {};
    const href = resolveLink(spec.successLink.path, spec.successLink.params, {
      ...row,
      ...resultData,
    });
    if (!href) return "Action succeeded but the follow-up link is missing data";
    client.navigate(href);
    return undefined;
  } catch (cause) {
    return cause instanceof Error ? cause.message : "Action failed";
  }
}
