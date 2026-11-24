import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import postgres from "postgres";
import { createPostgreSQLClient } from "./client.js";
import {
  createPostgreSQLContext,
  type PostgreSQLContext,
  postgresqlConnectionSchema,
} from "./context.js";
import { postgresqlDatasets } from "./datasets.js";

/**
 * Runs against a real server, so it is opt-in:
 * DSUI_TEST_POSTGRES_URL=postgres://user:password@host:5432/database
 */
const url = process.env.DSUI_TEST_POSTGRES_URL;

const SCHEMA = "dm_test";

describe.skipIf(!url)("PostgreSQL datasets against a real server", () => {
  let admin: postgres.Sql;
  let ctx: PostgreSQLContext;

  const observe = async (...names: string[]) =>
    postgresqlDatasets.observe(
      names.map((name) => ({ name })),
      ctx,
    );

  /** Statistics reach other sessions asynchronously, so poll for them. */
  async function until<T>(read: () => Promise<T>, ok: (value: T) => boolean) {
    const deadline = Date.now() + 10_000;
    for (;;) {
      const value = await read();
      if (ok(value) || Date.now() > deadline) return value;
      await Bun.sleep(250);
    }
  }

  beforeAll(async () => {
    const parsed = new URL(url as string);
    const config = postgresqlConnectionSchema.parse({
      host: parsed.hostname,
      port: parsed.port || 5432,
      database: parsed.pathname.slice(1),
      username: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      sslMode: "disable",
    });
    ctx = createPostgreSQLContext(createPostgreSQLClient(config), config);
    admin = postgres(url as string);
    await admin.unsafe(`
      drop schema if exists ${SCHEMA} cascade;
      create schema ${SCHEMA};
      create table ${SCHEMA}.orders (
        id bigint primary key,
        placed_at timestamptz not null,
        note text
      );
      create view ${SCHEMA}.orders_v as select id from ${SCHEMA}.orders;
      create materialized view ${SCHEMA}.orders_m as select id from ${SCHEMA}.orders;
      create table ${SCHEMA}.events (
        day date not null,
        payload text
      ) partition by range (day);
      create table ${SCHEMA}.events_a partition of ${SCHEMA}.events
        for values from ('2026-01-01') to ('2026-02-01');
      create table ${SCHEMA}.events_b partition of ${SCHEMA}.events
        for values from ('2026-02-01') to ('2026-03-01');
      create table ${SCHEMA}."odd.name" (id int);
      insert into ${SCHEMA}.orders
        select g, now(), null from generate_series(1, 100) g;
      insert into ${SCHEMA}.events
        select '2026-01-15'::date, 'a' from generate_series(1, 30);
      insert into ${SCHEMA}.events
        select '2026-02-15'::date, 'b' from generate_series(1, 20);
      analyze ${SCHEMA}.orders;
      analyze ${SCHEMA}.events;
    `);
  });

  afterAll(async () => {
    await admin?.unsafe(`drop schema if exists ${SCHEMA} cascade`);
    await admin?.end();
    await ctx?.dispose();
  });

  async function listAll(limit: number) {
    const names: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await postgresqlDatasets.list({ cursor, limit }, ctx);
      names.push(...page.items.map((item) => item.ref.name));
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 100);
    return { names, pages };
  }

  test("lists tables, views and partitioned parents, never partitions or system relations", async () => {
    const page = await postgresqlDatasets.list({ limit: 1_000 }, ctx);
    const mine = page.items.filter((item) =>
      item.ref.name.startsWith(`${SCHEMA}.`),
    );
    expect(Object.fromEntries(mine.map((i) => [i.ref.name, i.kind]))).toEqual({
      [`${SCHEMA}.events`]: "table",
      [`${SCHEMA}.odd.name`]: "table",
      [`${SCHEMA}.orders`]: "table",
      [`${SCHEMA}.orders_m`]: "materialized-view",
      [`${SCHEMA}.orders_v`]: "view",
    });
    expect(
      page.items.some((item) =>
        /^(pg_|information_schema)/.test(item.ref.name),
      ),
    ).toBe(false);
  });

  test("pages without gaps or repeats, whatever the page size", async () => {
    const everything = await listAll(1_000);
    for (const size of [1, 2, 3]) {
      const paged = await listAll(size);
      expect(paged.names).toEqual(everything.names);
      expect(new Set(paged.names).size).toBe(paged.names.length);
    }
    expect((await listAll(2)).pages).toBeGreaterThan(1);
  });

  test("rejects a cursor it did not issue", async () => {
    await expect(
      postgresqlDatasets.list({ cursor: "not a cursor", limit: 10 }, ctx),
    ).rejects.toThrow("Invalid dataset cursor");
  });

  test("measures a table from the statistics, as an estimate", async () => {
    const [orders] = await observe(`${SCHEMA}.orders`);
    expect(orders).toMatchObject({
      ref: { name: `${SCHEMA}.orders` },
      rowCount: 100,
      rowCountExact: false,
    });
    expect(orders?.bytes).toBeGreaterThan(0);
    expect(orders?.lastModifiedAt).toBeUndefined();
    expect(orders?.columns).toEqual([
      { name: "id", type: "bigint", nullable: false },
      { name: "placed_at", type: "timestamp with time zone", nullable: false },
      { name: "note", type: "text", nullable: true },
    ]);
  });

  test("measures a partitioned table across its partitions", async () => {
    const [events] = await observe(`${SCHEMA}.events`);
    expect(events?.rowCount).toBe(50);
    expect(events?.bytes).toBeGreaterThan(0);
    expect(events?.columns?.map((column) => column.name)).toEqual([
      "day",
      "payload",
    ]);
  });

  test("reports columns but no size or rows for a plain view", async () => {
    const [view] = await observe(`${SCHEMA}.orders_v`);
    expect(view?.rowCount).toBeUndefined();
    expect(view?.bytes).toBeUndefined();
    expect(view?.changeCounter).toBeUndefined();
    expect(view?.columns).toEqual([
      { name: "id", type: "bigint", nullable: true },
    ]);
  });

  test("finds a relation whose name contains a dot", async () => {
    const [odd] = await observe(`${SCHEMA}.odd.name`);
    expect(odd?.ref.name).toBe(`${SCHEMA}.odd.name`);
    expect(odd?.columns).toEqual([
      { name: "id", type: "integer", nullable: true },
    ]);
  });

  test("leaves out a relation that does not exist instead of failing", async () => {
    const result = await observe(`${SCHEMA}.orders`, `${SCHEMA}.dropped`);
    expect(result.map((item) => item.ref.name)).toEqual([`${SCHEMA}.orders`]);
  });

  test("the change counter grows with writes", async () => {
    const read = async () =>
      (await observe(`${SCHEMA}.orders`))[0]?.changeCounter ?? 0;
    // PostgreSQL flushes a backend's pending statistics when it exits.
    await admin.end();
    admin = postgres(url as string);
    const before = await until(read, (value) => value > 0);
    expect(before).toBeGreaterThan(0);
    await admin.unsafe(
      `insert into ${SCHEMA}.orders select g, now(), null from generate_series(101, 140) g`,
    );
    await admin.end();
    admin = postgres(url as string);
    const after = await until(read, (value) => value > before);
    expect(after).toBeGreaterThanOrEqual(before + 40);
  }, 30_000);

  test("sees a dropped column on the next observation", async () => {
    await admin.unsafe(
      `alter table ${SCHEMA}."odd.name" add column extra text`,
    );
    const [added] = await observe(`${SCHEMA}.odd.name`);
    expect(added?.columns?.map((column) => column.name)).toEqual([
      "id",
      "extra",
    ]);
    await admin.unsafe(`alter table ${SCHEMA}."odd.name" drop column extra`);
    const [dropped] = await observe(`${SCHEMA}.odd.name`);
    expect(dropped?.columns?.map((column) => column.name)).toEqual(["id"]);
  });
});
