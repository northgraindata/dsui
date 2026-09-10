import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { AdapterWorkspace } from "./AdapterWorkspace";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/">{children}</a>,
}));

test("renders a service without an endpoint", () => {
  const html = renderToStaticMarkup(
    <AdapterWorkspace
      service={{ id: "memory", name: "DuckDB", adapter: "duckdb", category: "database", health: "healthy" }}
      paths={["/"]}
    >
      Database content
    </AdapterWorkspace>,
  );
  expect(html).toContain("Database content");
  expect(html).toContain("DuckDB");
  expect(html).toContain("No endpoint provided");
});
