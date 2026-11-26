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

test("a failed submit shows a toast and moves nothing", async ({ page }) => {
  await open(page, "/services/airflow/connections/new", "error");
  const form = page.locator(".dsui-page form");
  const submit = form.getByRole("button", { name: "Create connection" });
  // Scroll first, so only a layout change can move the form afterwards.
  await submit.scrollIntoViewIfNeeded();
  const before = await form.boundingBox();
  await submit.click();
  await expect(page.locator("[data-sonner-toast]")).toContainText(
    "Create connection failed",
  );
  await expect(submit).toHaveAttribute("data-state", "error");
  expect(await form.boundingBox()).toEqual(before);
});
