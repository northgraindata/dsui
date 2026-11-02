/** A parsed CSV document: the header row and the data rows as string cells. */
export interface CsvTable {
  columns: string[];
  rows: string[][];
}

/**
 * Parses RFC 4180 CSV as produced by Shaper's `/api/sql`.
 *
 * Shaper streams the result and cannot report an error once the first byte is
 * sent, so a response that stops inside a quoted field is the only evidence of
 * a cut-off stream. That case throws instead of returning a silently short
 * table.
 */
export function parseCsv(text: string, maxRows = Number.POSITIVE_INFINITY) {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let started = false;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    records.push(row);
    row = [];
    started = false;
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index++;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
      started = true;
    } else if (char === ",") {
      started = true;
      endCell();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endRow();
      if (records.length > maxRows + 1) break;
    } else {
      started = true;
      cell += char;
    }
  }
  if (quoted) throw new Error("Shaper result ended inside a quoted value");
  if (started || cell !== "") endRow();

  const [header, ...rows] = records;
  if (!header) return { columns: [], rows: [], truncated: false };
  return {
    columns: header,
    rows: rows.slice(0, maxRows),
    truncated: rows.length > maxRows,
  };
}

/** Turns positional cells into records keyed by column, for the table UI. */
export function csvRecords(
  table: Pick<CsvTable, "columns" | "rows">,
): Record<string, string>[] {
  return table.rows.map((cells) => {
    const record: Record<string, string> = {};
    table.columns.forEach((column, position) => {
      record[column] = cells[position] ?? "";
    });
    return record;
  });
}
