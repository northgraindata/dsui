/**
 * A stand-in for Airflow's REST API with 250 records per list. Like Airflow,
 * it honours `limit`, `offset` and `order_by`, and without `order_by` it
 * returns the oldest records first.
 */
export const TOTAL = 250;

const at = (index: number) =>
  new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString();

const records: Record<string, [string, (index: number) => object]> = {
  eventLogs: [
    "event_logs",
    (i) => ({
      event_log_id: i,
      when: at(i),
      event: "success",
      dag_id: `dag_${i}`,
      owner: "airflow",
    }),
  ],
  connections: [
    "connections",
    (i) => ({
      connection_id: `conn_${String(i).padStart(3, "0")}`,
      conn_type: "postgres",
    }),
  ],
  variables: [
    "variables",
    (i) => ({ key: `var_${String(i).padStart(3, "0")}` }),
  ],
  pools: [
    "pools",
    (i) => ({ name: `pool_${String(i).padStart(3, "0")}`, slots: 4 }),
  ],
  dags: [
    "dags",
    (i) => ({
      dag_id: `dag_${String(i).padStart(3, "0")}`,
      is_paused: i % 10 === 0,
    }),
  ],
};

export function fakeAirflow() {
  const requests: URL[] = [];
  const fetchFn = (async (input: URL | string) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/token")
      return Response.json({ access_token: "token" });
    requests.push(url);
    const resource = url.pathname.split("/").at(-1) ?? "";
    const known = records[resource];
    if (!known) return new Response("not found", { status: 404 });
    const [name, make] = known;
    const order = url.searchParams.get("order_by") ?? "";
    const rows = Array.from({ length: TOTAL }, (_, i) => make(i + 1));
    if (order.startsWith("-")) rows.reverse();
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 100));
    return Response.json({
      [name]: rows.slice(offset, offset + limit),
      total_entries: TOTAL,
    });
  }) as typeof fetch;
  return { fetchFn, requests };
}
