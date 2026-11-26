import { expect, test } from "@playwright/test";

// Guards the evidence behind the Radix decision while it is open.
test("in a modal, Escape closes the list before the modal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?spike=1");
  await page.getByRole("button", { name: "Open modal" }).click();
  await page.getByRole("combobox", { name: "Database modal" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "analytics" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "warehouse" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});
