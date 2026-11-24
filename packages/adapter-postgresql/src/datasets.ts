import {
  type DatasetColumn,
  type DatasetObservation,
  defineDatasets,
} from "@northgraindata/dsui-adapter-sdk";
import type { PostgreSQLContext } from "./context.js";

/** A page cursor is the last relation returned, so paging survives new tables. */
function decodeCursor(
  cursor: string | undefined,
): { schema: string; name: string } | undefined {
  if (!cursor) return undefined;
  try {
    const parsed: unknown = JSON.parse(cursor);
    if (
      Array.isArray(parsed) &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string"
    )
      return { schema: parsed[0], name: parsed[1] };
  } catch {
    // Fall through to the error below.
  }
  throw new Error("Invalid dataset cursor");
}

/**
 * Lists and measures relations from the connected database.
 *
 * Measures come from the statistics views, never from the data, so a call costs
 * a catalog read however large the tables are. They are estimates: a table's
 * `rowCount` is the server's live-tuple statistic, and `changeCounter` is the
 * count of inserts, updates and deletes since the statistics were last reset.
 * A reset (a crash, `pg_stat_reset`) lowers the counter, which a consumer
 * reads as a restart of the series rather than as a change.
 *
 * PostgreSQL records no modification time, so `lastModifiedAt` is never set.
 */
export const postgresqlDatasets = defineDatasets<PostgreSQLContext>({
  async list({ cursor, limit }, ctx) {
    // One extra row says whether another page follows.
    const rows = await ctx.client.listDatasets(decodeCursor(cursor), limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        ref: { name: `${row.schema}.${row.name}` },
        kind: row.kind,
      })),
      ...(rows.length > limit && last
        ? { nextCursor: JSON.stringify([last.schema, last.name]) }
        : {}),
    };
  },

  async observe(refs, ctx) {
    const names = refs.map((ref) => ref.name);
    const [measures, columns] = await Promise.all([
      ctx.client.measureDatasets(names),
      ctx.client.datasetColumns(names),
    ]);
    const columnsByRelation = new Map<string, DatasetColumn[]>();
    for (const column of columns) {
      const list = columnsByRelation.get(column.relation) ?? [];
      list.push({
        name: column.name,
        type: column.type,
        nullable: column.nullable,
      });
      columnsByRelation.set(column.relation, list);
    }
    const at = new Date().toISOString();
    // A relation that no longer exists has no row here and is left out.
    return measures.map((measure): DatasetObservation => {
      const hasRows = measure.rows !== null;
      return {
        ref: { name: measure.name },
        at,
        ...(hasRows
          ? { rowCount: Math.max(0, Math.round(measure.rows ?? 0)) }
          : {}),
        ...(hasRows ? { rowCountExact: false } : {}),
        ...(measure.bytes !== null
          ? { bytes: Math.max(0, Math.round(measure.bytes)) }
          : {}),
        ...(measure.changes !== null
          ? { changeCounter: Math.max(0, Math.round(measure.changes)) }
          : {}),
        columns: columnsByRelation.get(measure.name) ?? [],
      };
    });
  },
});
