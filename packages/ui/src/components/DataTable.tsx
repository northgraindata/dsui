import { Surface } from "./Surface";

export function DataTable({
  columns,
  rows,
}: {
  columns: readonly { id: string; label: string }[];
  rows: readonly Record<string, unknown>[];
}) {
  return (
    <Surface className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead className="border-b border-border bg-surface-hover text-secondary">
          <tr>
            {columns.map((column) => (
              <th key={column.id} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={JSON.stringify(row)}
              className="border-b border-border last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.id}
                  className="max-w-72 truncate px-3 py-2 text-primary"
                >
                  {formatCell(row[column.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
