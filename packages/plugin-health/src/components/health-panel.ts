import { Badge, Card, Table } from "@northgraindata/dsui-plugin-sdk";
import { badgeTone, type ProbeResult } from "../context.js";

export function healthTable(results: readonly ProbeResult[]) {
  if (results.length === 0)
    return Card({
      title: "No services configured",
      description: "Add a service to see its health here.",
      variant: "subtle",
    });

  const rows = results.map((result) => ({
    name: result.name,
    adapter: result.adapter,
    status: result.health,
    tone: badgeTone(result),
    ping: result.latencyMs === undefined ? "—" : `${result.latencyMs} ms`,
    detail: result.detail ?? "—",
  }));

  return Table({
    data: rows,
    columns: [
      { id: "name", label: "Service" },
      { id: "adapter", label: "Adapter" },
      {
        id: "status",
        label: "Status",
        renderCell: Badge({
          label: { field: "status" },
          tone: { field: "tone" },
          dot: true,
        }),
      },
      { id: "ping", label: "Ping" },
      { id: "detail", label: "Details" },
    ],
  });
}
