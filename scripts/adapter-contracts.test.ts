import { expect, test } from "bun:test";
import clickhouse from "../packages/adapter-clickhouse/src/index";
import kafka from "../packages/adapter-kafka/src/index";
import polaris from "../packages/adapter-polaris/src/index";
import s3 from "../packages/adapter-s3/src/index";
import { checkAdapter } from "../packages/adapter-test/src/index";
import trino from "../packages/adapter-trino/src/index";

const adapters = [
  { adapter: kafka, connection: { brokers: ["localhost:9092"] } },
  { adapter: s3, connection: { endpoint: "http://localhost:9000" } },
  { adapter: trino, connection: { host: "localhost", username: "dsui" } },
  {
    adapter: clickhouse,
    connection: { host: "localhost", username: "default" },
  },
  {
    adapter: polaris,
    connection: { baseUrl: "http://localhost:8181", catalog: "default" },
  },
];

for (const { adapter, connection } of adapters) {
  test(`${adapter.id} implements the adapter contract`, async () => {
    const results = await checkAdapter(adapter, connection);
    expect(results).toEqual(
      expect.arrayContaining([expect.objectContaining({ ok: true })]),
    );
    expect(results.every((result) => result.ok)).toBe(true);
  });
}
