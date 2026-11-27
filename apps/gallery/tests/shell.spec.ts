import { expect, type Page, test } from "@playwright/test";
import { manifest } from "./fixtures";
import { collapsedControls, overflowingPanes } from "./layout-checks";

const WIDTHS = [390, 768, 1440];

/**
 * Warnings the application's own route table produces: two patterns match the
 * same URL. They predate the gallery and do not affect what renders.
 */
const KNOWN_WARNING = /^Generated path ".*" for route ".*" matched route/;

function watchProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (text.includes("net::ERR_FAILED") || KNOWN_WARNING.test(text)) return;
    problems.push(text);
  });
  return problems;
}

async function openApp(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  const separator = path.includes("?") ? "&" : "?";
  await page.goto(`${path}${separator}shell=1&scenario=default&toolbar=0`);
  await page.locator(".app-content").waitFor();
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

const SCREENS = [
  "/",
  "/services",
  "/services/new",
  "/adapters/airflow",
  "/settings",
  // Every adapter's home page, inside the real application frame.
  ...manifest.map((adapter) => `/services/${adapter.id}`),
];

for (const path of SCREENS)
  for (const width of WIDTHS)
    test(`app ${path} at ${width}`, async ({ page }) => {
      const problems = watchProblems(page);
      await openApp(page, path, width);
      expect.soft(problems, "console and page errors").toEqual([]);
      expect
        .soft(await overflowingPanes(page), "horizontal overflow")
        .toEqual([]);
      expect
        .soft(await collapsedControls(page), "collapsed controls")
        .toEqual([]);
    });

const EDITORS = [
  { mode: "without shell", url: "/?adapter=duckdb&page=query&toolbar=0" },
  { mode: "with shell", url: "/services/duckdb/query?shell=1&toolbar=0" },
];

for (const { mode, url } of EDITORS)
  test(`running a query shows its result ${mode}`, async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto(`${url}&scenario=default`);
    // The editor loads lazily; keys typed before it is ready are lost.
    await page.waitForLoadState("networkidle");
    const run = page.locator(".dsui-run-query");
    await expect(async () => {
      await page.locator(".dsui-sql-editor-wrap").click();
      await page.keyboard.type("SELECT 1;", { delay: 30 });
      await expect(run).toBeEnabled({ timeout: 500 });
    }).toPass();
    await run.click();
    const results = page.locator(".dsui-query-results");
    await expect(results).toContainText("4 rows");
    await expect(results).toContainText("order_id");
    expect(problems).toEqual([]);
  });

const TAB_MODES = [
  {
    mode: "without shell",
    url: "/?adapter=airflow&page=dags~_dagId&toolbar=0",
  },
  { mode: "with shell", url: "/services/airflow/dags/daily_revenue?shell=1" },
];

for (const { mode, url } of TAB_MODES)
  test(`linked tabs open their content ${mode}`, async ({ page }) => {
    const problems = watchProblems(page);
    await page.goto(`${url}&scenario=default&toolbar=0`);
    for (const name of ["Runs", "Tasks", "Code", "Graph", "Overview"]) {
      const tab = page.getByRole("tab", { name, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
    }
    await expect(page.getByText("DAG details")).toBeVisible();
    expect(problems).toEqual([]);
  });

test("the DAG header pauses only through a named, state-matched button", async ({
  page,
}) => {
  const problems = watchProblems(page);
  await openApp(page, "/services/airflow/dags/daily_revenue", 1440);
  const actions = page.locator(".dsui-page-header-actions button");
  await expect(actions).toHaveText([/^(Pause|Unpause)$/, "Trigger"]);
  expect(problems).toEqual([]);
});
