/**
 * Condition specification for matching records or rows against field values.
 */
export interface ConditionSpec {
  field: string;
  equals?: string | number | boolean;
  notEquals?: string | number | boolean;
}

/**
 * Evaluates whether a row or record matches a condition specification.
 * Returns true if no condition is provided.
 */
export function matchesWhen(
  row: Record<string, unknown>,
  when?: ConditionSpec,
): boolean {
  if (!when) return true;
  const value = row[when.field];
  if (when.equals !== undefined && value !== when.equals) return false;
  if (when.notEquals !== undefined && value === when.notEquals) return false;
  return true;
}

/**
 * Evaluates whether an action should be disabled based on a condition specification.
 * Returns false when no condition is supplied (retaining absent-condition behavior).
 */
export function isRowActionDisabled(
  row: Record<string, unknown>,
  when?: ConditionSpec,
): boolean {
  return when ? matchesWhen(row, when) : false;
}
