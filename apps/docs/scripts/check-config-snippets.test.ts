import { describe, expect, test } from "bun:test";
import { configProblems, yamlSnippets } from "./check-config-snippets";

const valid = `adapters:
  duckdb:
    source: git
    repository: "git+https://github.com/northgraindata/dsui"
    path: packages/adapter-duckdb
services:
  - id: local-duckdb
    adapter: duckdb
    connection:
      method: memory
`;

describe("configProblems", () => {
  test("accepts a complete configuration", () => {
    expect(configProblems(valid)).toEqual([]);
  });

  test("ignores YAML that is not a configuration", () => {
    expect(configProblems("name: web\nimage: nginx\n")).toEqual([]);
  });

  test("ignores a Docker Compose file", () => {
    expect(
      configProblems("services:\n  dsui:\n    image: ghcr.io/x/y:latest\n"),
    ).toEqual([]);
  });

  test("flags a service whose adapter is not declared", () => {
    expect(
      configProblems("services:\n  - id: a\n    adapter: duckdb\n"),
    ).toEqual(['services.a: adapter "duckdb" is not declared under adapters']);
  });

  test("validates plugin entries", () => {
    expect(configProblems("plugins:\n  x:\n    source: git\n")[0]).toContain(
      "plugins.x",
    );
  });

  test("flags package adapter sources", () => {
    const text = "adapters:\n  x:\n    package: some-package\n";
    expect(configProblems(text)[0]).toContain(
      "package sources can't be loaded",
    );
  });

  test("flags schema errors", () => {
    expect(
      configProblems("services:\n  - id: Bad_Id\n    adapter: a\n")[0],
    ).toContain("service id must be kebab-case");
  });
});

describe("yamlSnippets", () => {
  test("extracts yaml fences with their starting line", () => {
    const source = "text\n\n```yaml {1}\na: 1\n```\n\n```bash\nls\n```\n";
    expect(yamlSnippets(source)).toEqual([{ line: 3, text: "a: 1\n" }]);
  });
});
