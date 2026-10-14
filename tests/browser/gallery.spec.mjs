import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync(new URL("../../images/manifest.json", import.meta.url), "utf8"));
const natureCount = manifest.filter((item) =>
  [item.title, item.tags, decodeURIComponent(item.src)].join(" ").includes("自然")
).length;

async function mockManifest(page, data) {
  await page.route("**/images/manifest.json", (route) => route.fulfill({ json: data }));
}

async function loaded(page) {
  await page.goto("/");
  await expect(page.locator("#gallery")).toHaveAttribute("aria-busy", "false");
}

test("loads the gallery, filters and reuses cards", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await loaded(page);
  await expect(page.locator(".card")).toHaveCount(manifest.length);
  await page.evaluate(() => { window.firstCard = document.querySelector(".card"); });
  await page.getByRole("searchbox").fill("自然");
  await expect(page.locator(".card")).toHaveCount(natureCount);
  await page.getByRole("searchbox").fill("不存在的關鍵字");
  await expect(page.locator("#empty")).toBeVisible();
  await expect(page.locator(".card")).toHaveCount(0);
  await page.getByRole("searchbox").fill("");
  await expect(page.locator(".card")).toHaveCount(manifest.length);
  expect(await page.evaluate(() => window.firstCard === document.querySelector(".card"))).toBe(true);
  expect(errors).toEqual([]);
});

test("keyboard lightbox traps focus, Escape closes and restores focus", async ({ page }) => {
  await loaded(page);
  const trigger = page.locator(".card-open").first();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  const close = page.getByRole("button", { name: "關閉", exact: true });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  // Chromium may cycle through the document itself, but never background controls.
  expect(await page.evaluate(() => !["search", "sort"].includes(document.activeElement.id))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator("body")).not.toHaveClass("lightbox-open");
  await expect(page.locator("#lightbox-img")).not.toHaveAttribute("src");
});

test("caption opens lightbox, image click keeps it open, background and button close it", async ({ page }) => {
  await loaded(page);
  await page.locator(".caption").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator("#lightbox-img").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".card-open").first().click();
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("empty manifests never trigger image probing", async ({ page }) => {
  const requestedImages = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") requestedImages.push(request.url());
  });
  await mockManifest(page, []);
  await loaded(page);
  await expect(page.locator("#empty")).toHaveText("圖庫目前沒有圖片。");
  await expect(page.locator("#retry")).toBeHidden();
  expect(requestedImages).toEqual([]);
});

test("manifest failure shows retry instead of probing filenames", async ({ page }) => {
  let attempts = 0;
  const requestedImages = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") requestedImages.push(request.url());
  });
  await page.route("**/images/manifest.json", (route) => {
    attempts += 1;
    return attempts === 1 ? route.fulfill({ status: 503 })
      : route.fulfill({ json: [{ src: "images/01.jpg" }] });
  });
  await loaded(page);
  await expect(page.locator("#status")).toContainText("無法載入圖片清單");
  await expect(page.getByRole("searchbox")).toBeDisabled();
  expect(requestedImages).toEqual([]);
  await page.getByRole("button", { name: "重新載入" }).click();
  await expect(page.locator(".card")).toHaveCount(1);
  await expect(page.getByRole("searchbox")).toBeEnabled();
  expect(attempts).toBe(2);
});

test("invalid data is rejected, metadata markup never executes", async ({ page }) => {
  await mockManifest(page, [{ src: "https://example.com/a.jpg" }]);
  await loaded(page);
  await expect(page.locator("#retry")).toBeVisible();
  await page.unroute("**/images/manifest.json");
  const title = '<img src=x onerror="window.injected=true">';
  await mockManifest(page, [{ src: "images/01.jpg", title }]);
  await page.locator("#retry").click();
  await expect(page.locator(".caption")).toHaveText(title);
  await expect(page.locator(".caption img")).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test("random order stays stable while searching", async ({ page }) => {
  await loaded(page);
  await page.getByRole("combobox").selectOption("random");
  const order = await page.locator(".card-open").evaluateAll((buttons) => buttons.map((b) => b.dataset.src));
  await page.getByRole("searchbox").fill("自然");
  await expect(page.locator(".card")).toHaveCount(natureCount);
  await page.getByRole("searchbox").fill("");
  await expect(page.locator(".card")).toHaveCount(manifest.length);
  expect(await page.locator(".card-open").evaluateAll((buttons) => buttons.map((b) => b.dataset.src))).toEqual(order);
});

test("broken images have readable error states", async ({ page }) => {
  await mockManifest(page, [{ src: "images/missing.jpg", title: "Missing" }]);
  await loaded(page);
  await expect(page.locator(".image-error")).toBeVisible();
  await page.locator(".card-open").click();
  await expect(page.locator("#lightbox-error")).toBeVisible();
  await expect(page.locator("#lightbox-img")).toBeHidden();
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await loaded(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".card-open").first().click();
  await expect(page.getByRole("button", { name: "關閉", exact: true })).toBeInViewport();
});

test("a stalled manifest times out and exposes retry", async ({ page }) => {
  await page.clock.install();
  await page.route("**/images/manifest.json", () => {});
  await page.goto("/");
  await expect(page.locator("#gallery")).toHaveAttribute("aria-busy", "true");
  await page.clock.fastForward(10001);
  await expect(page.locator("#retry")).toBeVisible();
  await expect(page.locator("#gallery")).toHaveAttribute("aria-busy", "false");
});


test("every manifest image loads and can open in the lightbox", async ({ page }) => {
  await loaded(page);
  for (const item of manifest) {
    // A title search also ensures newly added metadata is searchable.
    await page.getByRole("searchbox").fill(item.title);
    const trigger = page.getByRole("button", { name: `放大檢視：${item.title}`, exact: true });
    await expect(trigger).toBeVisible();
    await expect(trigger.locator("img")).toBeVisible();
    await expect.poll(() => trigger.locator("img").evaluate((image) =>
      image.complete && image.naturalWidth > 0
    )).toBe(true);
    await trigger.click();
    await expect(page.locator("#lightbox-caption")).toContainText(item.title);
    await expect.poll(() => page.locator("#lightbox-img").evaluate((image) =>
      image.complete && image.naturalWidth > 0
    )).toBe(true);
    await page.keyboard.press("Escape");
  }
});
