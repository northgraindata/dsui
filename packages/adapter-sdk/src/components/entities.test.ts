import { expect, test } from "bun:test";
import {
  parseEntityCatalog,
  parseEntityDetail,
} from "@northgraindata/dsui-core";
import { defineResource } from "../resource/index";
import { EntityCatalog, EntityDetail } from "./entities";
import { serializeNode } from "./serialize";

const source = defineResource({ id: "catalog", query: () => [] });
test("entity nodes serialize resource identity without live bindings", () => {
  expect(
    serializeNode(EntityCatalog({ title: "Packages", source: source() })),
  ).toEqual({
    kind: "entity-catalog",
    props: { title: "Packages", source: { resourceId: "catalog" } },
  });
  expect(serializeNode(EntityDetail({ source: source() }))).toEqual({
    kind: "entity-detail",
    props: { source: { resourceId: "catalog" } },
  });
});
test("entity components use the shared component definition metadata", () => {
  expect(EntityCatalog.kind).toBe("component");
  expect(EntityCatalog.id).toBe("entity-catalog");
  expect(EntityDetail.kind).toBe("component");
  expect(EntityDetail.id).toBe("entity-detail");
});
test("catalog rejects malformed records, duplicate IDs and unsafe navigation", () => {
  const item = { id: "item", title: "Item", description: "Description" };
  expect(parseEntityCatalog([item])).toEqual([expect.objectContaining(item)]);
  expect(() => parseEntityCatalog([item, item])).toThrow("Duplicate");
  expect(() =>
    parseEntityCatalog([{ ...item, link: "//evil.example" }]),
  ).toThrow();
  expect(() =>
    parseEntityCatalog([{ ...item, status: { label: "OK", tone: "invalid" } }]),
  ).toThrow();
  expect(() =>
    parseEntityCatalog([{ ...item, actions: [{ label: "Broken" }] }]),
  ).toThrow();
  expect(() => parseEntityCatalog({ rows: [] })).toThrow();
});
test("detail validates nested actions, links, and unique tab identities", () => {
  const detail = {
    title: "Item",
    description: "Description",
    tabs: [
      {
        id: "overview",
        label: "Overview",
        panels: [{ title: "About", description: "Text" }],
      },
    ],
  };
  expect(parseEntityDetail(detail).tabs).toHaveLength(1);
  expect(() => parseEntityDetail({ ...detail, tabs: [] })).toThrow();
  expect(() =>
    parseEntityDetail({ ...detail, tabs: [detail.tabs[0], detail.tabs[0]] }),
  ).toThrow();
  expect(() =>
    parseEntityDetail({
      ...detail,
      tabs: [
        {
          id: "overview",
          label: "Overview",
          panels: [
            {
              title: "About",
              links: [{ label: "Bad", url: "javascript:alert(1)" }],
            },
          ],
        },
      ],
    }),
  ).toThrow();
});
