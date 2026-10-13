import { expect, test } from "bun:test";
import { scopeForPaths } from "./ci-scope";
import { registryRange } from "./release-packages";

test("product changes do not run SDK pipelines", () => {
  expect(scopeForPaths(["apps/web/src/app.tsx"], "adapter-sdk").run).toBe(
    false,
  );
  expect(scopeForPaths(["apps/web/src/app.tsx"], "plugin-sdk").run).toBe(false);
  expect(scopeForPaths(["apps/web/src/app.tsx"], "product").run).toBe(true);
});
test("SDK changes verify downstream host without Docker", () => {
  const paths = ["packages/adapter-sdk/src/index.ts"];
  expect(scopeForPaths(paths, "adapter-sdk").run).toBe(true);
  expect(scopeForPaths(paths, "plugin-sdk").run).toBe(true);
  expect(scopeForPaths(paths, "product")).toEqual({
    run: true,
    docs: false,
    docker: false,
  });
  expect(
    scopeForPaths(["packages/plugin-sdk/src/index.ts"], "adapter-sdk").run,
  ).toBe(false);
});
test("docs-only changes avoid runtime checks", () => {
  expect(
    scopeForPaths(["apps/docs/content/docs/plugin-sdk/pages.mdx"], "product"),
  ).toEqual({ run: false, docs: true, docker: false });
});
test("shared build inputs verify every layer", () => {
  for (const layer of ["adapter-sdk", "plugin-sdk", "product"] as const)
    expect(scopeForPaths(["bun.lock"], layer).run).toBe(true);
});
test("publication resolves workspace dependencies and rejects missing packages", () => {
  expect(registryRange("workspace:*", "0.2.0")).toBe("0.2.0");
  expect(registryRange("workspace:^", "0.2.0")).toBe("^0.2.0");
  expect(() => registryRange("workspace:*", undefined)).toThrow();
});

test("package README and banner changes avoid runtime pipelines", () => {
  for (const layer of ["adapter-sdk", "plugin-sdk", "product"] as const)
    expect(
      scopeForPaths(
        [
          "packages/adapter-sdk/README.md",
          "packages/plugin-sdk/assets/banner.png",
        ],
        layer,
      ).run,
    ).toBe(false);
});
