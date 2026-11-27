import { expect, type Page, test } from "@playwright/test";

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/?harness=select");
  return errors;
}

test("an option with an empty value keeps its label when closed", async ({
  page,
}) => {
  const errors = await open(page);
  const state = page.getByRole("combobox", { name: "State" });
  await expect(state).toHaveText("All states");
  await state.click();
  await page.getByRole("option", { name: "Active" }).click();
  await expect(state).toHaveText("Active");
  await state.click();
  await page.getByRole("option", { name: "All states" }).click();
  await expect(state).toHaveText("All states");
  expect(errors).toEqual([]);
});

test("a form requires a choice and submits it by name", async ({ page }) => {
  const errors = await open(page);
  const save = page.getByRole("button", { name: "Save" });
  await save.click();
  await expect(page.getByTestId("submitted")).toHaveText("");
  await page.getByRole("combobox", { name: "Engine" }).click();
  await page.getByRole("option", { name: "DuckDB" }).click();
  await save.click();
  await expect(page.getByTestId("submitted")).toHaveText(
    '[["engine","duckdb"]]',
  );
  expect(errors).toEqual([]);
});

test("in a native modal dialog the list is usable and Escape keeps the dialog", async ({
  page,
}) => {
  const errors = await open(page);
  await page.getByRole("button", { name: "Open native dialog" }).click();
  const select = page.getByRole("combobox", { name: "In dialog" });
  await select.click();
  // A list outside the modal dialog would be inert, and this click would fail.
  await page.getByRole("option", { name: "DuckDB" }).click();
  await expect(select).toHaveText("DuckDB");
  await select.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  expect(errors).toEqual([]);
});
