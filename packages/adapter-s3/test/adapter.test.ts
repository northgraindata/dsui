import { expect, test } from "bun:test";
import adapter from "../src/index";
test("requires complete static credentials", () => { expect(() => adapter.connectionSchema.parse({ endpoint: "http://minio:9000", accessKeyId: "one" })).toThrow(); });
test("keeps S3 pagination bounded", () => { expect(adapter.capabilities.find((capability) => capability.id === "objects")?.maxPageSize).toBe(1000); });
