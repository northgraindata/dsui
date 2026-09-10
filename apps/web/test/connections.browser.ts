import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1536, height: 1024 },
  });
  await page.route("**/api/v1/adapters", (route) =>
    route.fulfill({
      json: [
        {
          id: "duckdb",
          name: "DuckDB",
          description:
            "Browse DuckDB catalogs, run SQL, and manage extensions.",
          iconUrl:
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='24' fill='black'/%3E%3Ccircle cx='19' cy='24' r='11' fill='%23fff000'/%3E%3Cpath d='M34 20a4 4 0 1 0 0 8h5v-3h-5v-2h5v-3z' fill='%23fff000'/%3E%3C/svg%3E",
          status: "ok",
          resources: [],
          actions: [],
          pages: [],
          connectionMethods: [
            {
              id: "file",
              label: "Local file",
              description: "A .duckdb file on the server's filesystem.",
              schema: {
                type: "object",
                required: ["path"],
                properties: {
                  path: { type: "string" },
                  readOnly: { type: "boolean" },
                },
              },
            },
            {
              id: "memory",
              label: "In-memory",
              description:
                "An ephemeral :memory: database created per connection.",
              schema: {
                type: "object",
                properties: { readOnly: { type: "boolean" } },
              },
            },
          ],
        },
      ],
    }),
  );
  await page.goto("http://localhost:5173/services/new");
  await expect(
    page.getByRole("heading", { name: "Adapters", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Connect DuckDB", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Connect DuckDB" }),
  ).toBeVisible();
  await expect(
    page.getByText("Provide connection details", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(
    page.getByLabel("Database file path", { exact: true }),
  ).toBeFocused();
  await page
    .getByLabel("Database file path", { exact: true })
    .fill("/data/analytics.duckdb");
  await page.getByLabel("Connection name", { exact: true }).fill("My DuckDB");
  await page
    .getByRole("heading", { name: "Connect DuckDB", exact: true })
    .click();
  await page.evaluate(() => document.fonts.ready);
  console.log(
    await page
      .locator(".connection-primary")
      .last()
      .evaluate((element) => ({
        background: getComputedStyle(element).background,
        font: getComputedStyle(element).fontFamily,
      })),
  );
  await page.screenshot({ path: "/tmp/dsui-connections-desktop.png" });
  let attempts = 0;
  let saves = 0;
  let posted: unknown;
  await page.route("**/api/v1/services/test", async (route) => {
    posted = route.request().postDataJSON();
    attempts++;
    await route.fulfill({
      json: {
        status: attempts === 1 ? "unavailable" : "healthy",
        checkedAt: new Date().toISOString(),
        detail: attempts === 1 ? "File is unavailable" : undefined,
        latencyMs: 12,
      },
    });
  });
  await page.route("**/api/v1/services", async (route) => {
    saves++;
    await route.fulfill(
      saves === 1
        ? {
            status: 500,
            json: { message: "Could not save connection" },
          }
        : { json: { id: "saved-duckdb" } },
    );
  });
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(
    page.getByText("File is unavailable", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save connection" }),
  ).toHaveCount(0);
  expect(posted).toEqual({
    adapter: "duckdb",
    name: "My DuckDB",
    connection: { method: "file", path: "/data/analytics.duckdb" },
  });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByLabel("Database file path", { exact: true }),
  ).toHaveValue("/data/analytics.duckdb");
  await page.getByRole("radio", { name: /In-memory/ }).check();
  await expect(
    page.getByLabel("Database file path", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("switch", { name: "Read-only mode" }).check();
  await page
    .getByRole("button", { name: "Test connection", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Connection successful" }),
  ).toBeVisible();
  expect(posted).toEqual({
    adapter: "duckdb",
    name: "My DuckDB",
    connection: { method: "memory", readOnly: "true" },
  });
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save connection",
  );
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(
    page.getByRole("heading", { name: "You're all set!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open connection" }),
  ).toHaveAttribute("href", "/services/saved-duckdb");
  await page.screenshot({ path: "/tmp/dsui-connections-finish.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect DuckDB", exact: true }),
  ).toBeFocused();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByRole("button", { name: "Connect DuckDB", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Test connection", exact: true }),
    ).toBeInViewport();
    const dimensions = await page.getByRole("dialog").evaluate((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    for (let index = 0; index < 12; index++) {
      await page.keyboard.press("Tab");
      expect(
        await page
          .getByRole("dialog")
          .evaluate((element) => element.contains(document.activeElement)),
      ).toBe(true);
    }
    if (width === 320)
      await page.screenshot({ path: "/tmp/dsui-connections-mobile.png" });
    await page.keyboard.press("Escape");
  }
  await page.goto("http://localhost:5173/services");
  await expect(
    page.getByRole("heading", { name: "Adapters", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add adapter", exact: true }).click();
  await page.getByRole("textbox", { name: "Search adapters" }).fill("missing");
  await expect(page.getByText("No adapters match your search.")).toBeVisible();
  console.log(
    "Passed: catalog, validation, test failure/retry, method isolation, optional switch, save failure/retry, finish, focus trap/restore, 320/768/1024/1440 layouts, and search.",
  );
} finally {
  await browser.close();
}
