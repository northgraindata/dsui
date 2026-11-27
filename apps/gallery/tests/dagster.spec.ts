import { expect, type Page, test } from "@playwright/test";

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
});
test.afterEach(() => {
  expect(problems).toEqual([]);
});

async function open(page: Page, path: string) {
  await page.goto(`/services/dagster${path}?shell=1&design=new`);
  const view = page.locator(".ax-embedded-main");
  await view.locator("h1").first().waitFor();
  return view;
}

const pages = [
  "",
  "/runs",
  "/lineage",
  "/assets",
  "/assets/core/fct_invoices",
  "/jobs",
  "/jobs/dbt_core_build",
  "/jobs/warehouse_maintenance",
  "/automation",
  "/automation/partner_files_sensor",
  "/deployment",
  "/backfills/hrtmwzka",
];

for (const width of [1280, 760])
  test(`every page fits a ${width} px window`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of pages) {
      await open(page, path);
      expect
        .soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth - innerWidth,
          ),
          path || "/",
        )
        .toBeLessThanOrEqual(0);
    }
  });

test("lineage opens a group, explains a failure and narrows by query", async ({
  page,
}) => {
  const view = await open(page, "/lineage");
  await view
    .getByRole("button", { name: "core, 12 assets, collapsed" })
    .click();
  await view.getByRole("button", { name: "fct_invoices, Failed" }).click();
  const panel = view.getByRole("complementary", { name: "Asset fct_invoices" });
  await expect(panel).toContainText("invalid identifier");

  // The picked asset is outside this query, so nothing may stay dimmed by it.
  const query = view.getByLabel("Asset selection");
  await query.fill("+churn_scores");
  await expect(view.locator(".dx-count")).toContainText("of 141 assets");
  await expect(panel).toHaveCount(0);
  await expect(view.locator('.dx-world [data-dim="true"]')).toHaveCount(0);

  await query.fill("nothing_like_this");
  await expect(view.locator(".dx-canvas-empty")).toContainText(
    "No asset matches",
  );
  await view.getByRole("button", { name: "Show all assets" }).click();
  await expect(view.locator(".dx-count")).toHaveText("141 assets");
});

test("a failed run points at its step and filters the events to it", async ({
  page,
}) => {
  const view = await open(page, "/runs");
  await view.getByRole("button", { name: /^Failed/ }).click();
  await view
    .getByRole("link", { name: /Failure/ })
    .first()
    .locator("code")
    .first()
    .click();
  await expect(view.locator(".dx-run-failure")).toContainText(
    "fct_invoices failed",
  );
  await view.getByRole("button", { name: "Show in log" }).click();
  await expect(view.locator(".dx-event code").first()).toHaveText(
    "fct_invoices",
  );
  await expect(view.locator(".dx-event pre")).toContainText("000904");
  for (const step of await view.locator(".dx-event code").allTextContents())
    expect(step).toBe("fct_invoices");
  // Coming back keeps the filter.
  await view.getByRole("button", { name: "Runs", exact: true }).click();
  await expect(view.getByRole("button", { name: /^Failed/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a partition range becomes a backfill of that size", async ({ page }) => {
  const view = await open(page, "/assets/core/fct_product_events");
  await view.getByRole("tab", { name: "Partitions" }).click();
  await view.getByRole("button", { name: "2026-09-20, Missing" }).click();
  await view
    .getByRole("button", { name: "2026-09-24, Missing" })
    .click({ modifiers: ["Shift"] });
  await view.getByRole("button", { name: "Materialize range" }).click();
  await expect(
    page.getByRole("dialog").getByRole("button", {
      name: "Launch backfill (5)",
    }),
  ).toBeEnabled();
});

test("stopping a sensor is confirmed and shows on its row", async ({
  page,
}) => {
  const view = await open(page, "/automation");
  await view.getByRole("button", { name: /^Sensors/ }).click();
  await view.getByRole("button", { name: "Stop reverse_etl_sensor" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Stop" })
    .click();
  await expect(
    view.getByRole("button", { name: "Start reverse_etl_sensor" }),
  ).toBeVisible();
});

test("the overview shows a few failures, closed, and a calm day", async ({
  page,
}) => {
  const view = await open(page, "");
  const card = view.getByRole("region", { name: "Failing now" });
  await expect(card.locator("article")).toHaveCount(3);
  await expect(card.locator('[aria-expanded="true"]')).toHaveCount(0);
  await expect(card).toContainText("COUPON_PERCENT_OFF");
  // Other kinds of trouble take one line, not a list each.
  await expect(
    card.getByRole("button", { name: "1 code location not loaded" }),
  ).toBeVisible();
  expect((await card.boundingBox())?.height).toBeLessThan(330);
  await card.getByRole("button", { name: /dbt_core_build/ }).click();
  await expect(card.locator("pre")).toContainText("000904");

  await page.evaluate(() =>
    sessionStorage.setItem("dsui-prototype-failing", "none"),
  );
  await page.reload();
  await expect(view.getByText("Nothing is failing")).toBeVisible();
});
