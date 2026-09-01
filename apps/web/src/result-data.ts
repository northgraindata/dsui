export type ResultRecord = Record<string, unknown>;

export function rowsToRecords(
  data: unknown,
  columns: string[],
): ResultRecord[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((row) => {
    if (Array.isArray(row))
      return [
        Object.fromEntries(
          columns.map((column, index) => [column, row[index]]),
        ),
      ];
    if (row && typeof row === "object") return [row as ResultRecord];
    return [];
  });
}
