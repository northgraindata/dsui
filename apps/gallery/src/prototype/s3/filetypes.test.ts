import { describe, expect, test } from "bun:test";
import { fileType } from "./filetypes";

describe("file types", () => {
  test("reads the extension, and looks through compression", () => {
    expect(fileType("a/part-0001.snappy.parquet").preview).toBe("parquet");
    expect(fileType("events.jsonl.gz")).toMatchObject({
      preview: "records",
      compressed: true,
    });
    expect(fileType("backup.tar.gz").preview).toBe("archive");
    expect(fileType("REPORT.CSV").preview).toBe("table");
  });

  test("keeps folders and unknown names apart", () => {
    expect(fileType("raw/orders/").label).toBe("Folder");
    expect(fileType("_SUCCESS").label).toBe("File");
    expect(fileType("model.weights").preview).toBe("binary");
  });
});
