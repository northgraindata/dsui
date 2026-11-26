import { expect, type Page, test } from "@playwright/test";

let problems: string[] = [];

test.beforeEach(({ page }) => {
  problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    problems.push(message.text());
  });
  // The shared dialog replaces the browser's own.
  page.on("dialog", (dialog) => {
    problems.push(`native dialog: ${dialog.message()}`);
    void dialog.dismiss();
  });
});

test.afterEach(() => {
  expect(problems).toEqual([]);
});

async function open(page: Page, path: string, scenario = "default") {
  await page.goto(`${path}?shell=1&toolbar=0&scenario=${scenario}`);
  await page.locator(".app-content .dsui-page").waitFor();
}

const sent = (page: Page) => page.evaluate(() => window.galleryActions ?? []);
const confirmation = (page: Page) => page.getByRole("alertdialog");

test("deleting a connection names it, and only confirming sends the action", async ({
  page,
}) => {
  await open(page, "/services/airflow/connections");
  const more = page.getByRole("button", { name: /More actions for/ }).first();
  const name = ((await more.getAttribute("aria-label")) ?? "").replace(
    "More actions for ",
    "",
  );
  await more.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(confirmation(page)).toContainText(`Delete connection ${name}?`);
  await confirmation(page).getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation(page)).toHaveCount(0);
  expect(await sent(page)).toEqual([]);

  await more.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await confirmation(page)
    .getByRole("button", { name: "Delete connection" })
    .click();
  await expect(confirmation(page)).toHaveCount(0);
  expect(await sent(page)).toEqual(["delete-connection"]);
  await expect(page).toHaveURL(/\/services\/airflow\/connections/);
});

test("triggering from a row warns that it unpauses, and does not open the row", async ({
  page,
}) => {
  await open(page, "/services/airflow/dags");
  const trigger = page.getByRole("button", { name: /^Trigger / }).first();
  await trigger.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Trigger");
  await trigger.click();
  await expect(confirmation(page)).toContainText("it is unpaused first");
  const url = page.url();
  await confirmation(page).getByRole("button", { name: "Cancel" }).click();
  expect(page.url()).toBe(url);
  expect(await sent(page)).toEqual([]);
});

test("the DAG header asks before pausing", async ({ page }) => {
  await open(page, "/services/airflow/dags/daily_revenue");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(confirmation(page)).toContainText("Pause daily_revenue?");
  await confirmation(page).getByRole("button", { name: "Pause DAG" }).click();
  await expect(confirmation(page)).toHaveCount(0);
  expect(await sent(page)).toEqual(["pause-dag"]);
});

const modal = (page: Page) => page.getByRole("dialog");

test("creating opens a modal that cannot send an empty form or lose input silently", async ({
  page,
}) => {
  await open(page, "/services/airflow/connections");
  await page.getByRole("button", { name: "Add connection" }).click();
  const submit = modal(page).getByRole("button", {
    name: "Create connection",
  });
  await expect(submit).toBeDisabled();
  await expect(modal(page).getByLabel("Connection ID")).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(modal(page)).toBeVisible();
  await modal(page).getByLabel("Connection ID").fill("warehouse");
  await expect(submit).toBeEnabled();

  await page.keyboard.press("Escape");
  await expect(confirmation(page)).toContainText("Discard changes?");
  await confirmation(page)
    .getByRole("button", { name: "Keep editing" })
    .click();
  await expect(modal(page).getByLabel("Connection ID")).toHaveValue(
    "warehouse",
  );
  await submit.click();
  await expect(modal(page)).toHaveCount(0);
  expect(await sent(page)).toEqual(["create-connection"]);
  await expect(page).toHaveURL(/\/services\/airflow\/connections/);
});

test("editing fills the form from the row and closes freely when unchanged", async ({
  page,
}) => {
  await open(page, "/services/airflow/pools");
  const more = page.getByRole("button", { name: /More actions for/ }).first();
  const name = ((await more.getAttribute("aria-label")) ?? "").replace(
    "More actions for ",
    "",
  );
  await more.click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(modal(page)).toContainText(`Edit pool ${name}`);
  await expect(modal(page).getByLabel("Pool name")).toHaveValue(name);
  await expect(
    modal(page).getByRole("button", { name: "Save pool" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal(page)).toHaveCount(0);
  await expect(confirmation(page)).toHaveCount(0);
});

test("a failed submit keeps the modal and its input, and moves nothing", async ({
  page,
}) => {
  // The error scenario fails every read, so only the action may fail here.
  await open(page, "/services/airflow/connections", "error");
  await page.getByRole("button", { name: "Add connection" }).click();
  await modal(page).getByLabel("Connection ID").fill("warehouse");
  const form = modal(page).locator("form");
  const submit = modal(page).getByRole("button", {
    name: "Create connection",
  });
  await submit.scrollIntoViewIfNeeded();
  const before = await form.boundingBox();
  await submit.click();
  await expect(page.locator("[data-sonner-toast]")).toContainText(
    "Create connection failed",
  );
  await expect(submit).toHaveAttribute("data-state", "error");
  expect(await form.boundingBox()).toEqual(before);
  await expect(modal(page).getByLabel("Connection ID")).toHaveValue(
    "warehouse",
  );
});

test("ClickHouse creates a database from the header", async ({ page }) => {
  await open(page, "/services/clickhouse/data");
  await expect(page.locator(".dsui-page form")).toHaveCount(0);
  await page.getByRole("button", { name: "Create database" }).click();
  await modal(page).getByLabel("Database name").fill("staging");
  await modal(page).getByRole("button", { name: "Create database" }).click();
  await expect(modal(page)).toHaveCount(0);
  expect(await sent(page)).toEqual(["create-database"]);
});

test("a tree without a selection marks nothing selected", async ({ page }) => {
  await open(page, "/services/clickhouse/query");
  await expect(page.getByRole("treeitem").first()).toBeVisible();
  await expect(
    page.locator('[aria-selected="true"][role="treeitem"]'),
  ).toHaveCount(0);
});

test("details read as labels and values, not raw data", async ({ page }) => {
  await open(page, "/services/airflow/dags/daily_revenue");
  await page.getByRole("tab", { name: "Details" }).click();
  const details = page.locator(".dsui-key-value-panel");
  await expect(details).toContainText("Is paused");
  await expect(details.locator("dt", { hasText: /^isPaused$/ })).toHaveCount(0);
  await expect(
    details.locator("dd", { hasText: /^(true|false)$/ }),
  ).toHaveCount(0);
});

test("Clear all appears only once a table is sorted or filtered", async ({
  page,
}) => {
  await open(page, "/services/airflow/event-logs");
  const clear = page.getByRole("button", { name: "Clear all" });
  const table = page.locator(".dsui-page table");
  await expect(table).toBeVisible();
  await expect(clear).toHaveCount(0);
  const before = await table.boundingBox();
  await page.getByRole("button", { name: "Sort Time" }).click();
  await expect(clear).toBeVisible();
  expect(await table.boundingBox()).toEqual(before);
});
