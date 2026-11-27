import { expect, type Page, test } from "@playwright/test";

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning")
      errors.push(message.text());
  });
  await page.goto("/?harness=overlays");
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

const button = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true });
const toasts = (page: Page) => page.locator("[data-sonner-toast]");

test("a tooltip opens on keyboard focus and Escape closes it", async ({
  page,
}) => {
  await expect(button(page, "Model type")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(button(page, "Model type")).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveText("dbt incremental model");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

test("a menu lists destructive actions last and works by keyboard", async ({
  page,
}) => {
  await button(page, "More actions").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem")).toHaveText([
    "Pause",
    "Clear",
    "Delete",
  ]);
  await expect(page.getByRole("separator")).toHaveCount(1);
  await expect(page.getByRole("menuitem", { name: "Pause" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("log")).toHaveText("pause");
});

test("a confirmation keeps its size, blocks a second submit and closes on success", async ({
  page,
}) => {
  await button(page, "Pause DAG…").click();
  const dialog = page.getByRole("alertdialog");
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Pause DAG" });
  const before = await confirm.boundingBox();
  await confirm.dblclick();
  await expect(confirm).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(await confirm.boundingBox()).toEqual(before);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("log")).toHaveText("confirmed");
});

test("a failed confirmation stays open and can be cancelled", async ({
  page,
}) => {
  await button(page, "Failing action…").click();
  const dialog = page.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", { name: "Pause DAG" });
  await confirm.click();
  await expect(toasts(page)).toHaveCount(1);
  await expect(confirm).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("a repeated error is one toast that stays and offers retry", async ({
  page,
}) => {
  await page.clock.install();
  await page.reload();
  await button(page, "Show error").click();
  await button(page, "Show error").click();
  await button(page, "Show success").click();
  await expect(toasts(page)).toHaveCount(2);
  await page.clock.runFor(30_000);
  await expect(toasts(page)).toHaveCount(1);
  await expect(toasts(page)).toContainText("Could not trigger DAG");
  await toasts(page).getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("log")).toHaveText("retry");
});

test("a toast stays usable over a modal without closing it", async ({
  page,
}) => {
  await button(page, "Open modal").click();
  await button(page, "Fail inside modal").click();
  await toasts(page).getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("log")).toHaveText("retry");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("menus and tooltips work inside a native modal dialog", async ({
  page,
}) => {
  await button(page, "Open native dialog").click();
  await button(page, "Dialog menu").click();
  await page.getByRole("menuitem", { name: "Inside" }).click();
  await expect(page.getByTestId("log")).toHaveText("inside");
  await button(page, "Dialog hint").hover();
  await expect(page.getByRole("tooltip")).toHaveText("Tooltip in a dialog");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
});
