import { mkdir, writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const ARTIFACTS = "artifacts";
const SCREENSHOTS = `${ARTIFACTS}/screenshots`; 

async function openRuntime(
  page: Page,
  path = "/",
): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  await page.waitForFunction(() => window.pcAnatomy?.getState().status === "ready");
  await page.waitForTimeout(1_250);
  return errors;
}

async function cameraSnapshot(page: Page) {
  return page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());
}

test("hero presentation, inventory, camera controls, and baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openRuntime(page);

  const state = await page.evaluate(() => window.pcAnatomy?.getState());
  expect(state?.status).toBe("ready");
  if (state?.status !== "ready") throw new Error("Runtime did not become ready");
  expect(state.inventory).toEqual({
    rawGltfNodes: 51,
    namedLogicalNodes: 29,
    semanticComponents: 19,
    meshes: 25,
    materials: 17,
    animations: 21,
  });

  const performance = await page.evaluate(() => window.pcAnatomy?.getPerformance());
  expect(performance?.initialLoadMs).toBeGreaterThan(0);
  expect(performance?.steadyFps).toBeGreaterThan(0);
  expect(performance?.drawCalls).toBeGreaterThan(0);
  await mkdir(ARTIFACTS, { recursive: true });
  await writeFile(
    `${ARTIFACTS}/w1-performance.json`,
    JSON.stringify({
      environment: "Playwright headless Chrome on Windows; software/headless rendering may limit FPS",
      viewport: "1440x900",
      ...performance,
    }, null, 2),
  );

  const initial = await cameraSnapshot(page);
  expect(initial?.state).toBe("hero");
  await page.mouse.move(900, 450);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(1030, 500, { steps: 8 });
  await page.mouse.up({ button: "left" });
  const orbited = await cameraSnapshot(page);
  expect(orbited?.position).not.toEqual(initial?.position);

  await page.mouse.wheel(0, -450);
  await page.waitForTimeout(250);
  const zoomed = await cameraSnapshot(page);
  expect(zoomed?.distance).not.toBeCloseTo(orbited?.distance ?? 0, 3);

  await page.mouse.down({ button: "right" });
  await page.mouse.move(970, 390, { steps: 8 });
  await page.mouse.up({ button: "right" });
  const panned = await cameraSnapshot(page);
  expect(panned?.target).not.toEqual(zoomed?.target);

  await page.evaluate(() => window.pcAnatomy?.camera.reset(true));
  const reset = await cameraSnapshot(page);
  expect(reset?.state).toBe("hero");
  expect(reset?.position).toEqual(initial?.position);
  expect(errors).toEqual([]);

  await page.screenshot({ path: `${SCREENSHOTS}/w1-hero-assembled.png` });
});

test("open-case camera composition", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openRuntime(page);
  await page.evaluate(() => window.pcAnatomy?.camera.open(true));
  const camera = await cameraSnapshot(page);
  expect(camera?.state).toBe("open");
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${SCREENSHOTS}/w1-open-case.png` });
});

test("narrow responsive presentation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await openRuntime(page);
  const camera = await cameraSnapshot(page);
  expect(camera?.state).toBe("hero");
  expect(await page.locator("#experience-canvas").boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 390,
    height: 844,
  });
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${SCREENSHOTS}/w1-narrow-viewport.png` });
});

test("laptop-to-tablet resize preserves responsive hero framing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors = await openRuntime(page);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(250);
  expect(await page.locator("#experience-canvas").boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: 768,
    height: 1024,
  });
  expect((await cameraSnapshot(page))?.state).toBe("hero");
  expect(errors).toEqual([]);
});

test("debug mode is explicit and reports W1 telemetry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await openRuntime(page, "/?debug=1");
  const panel = page.locator(".debug-panel");
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-metric="rawGltfNodes"]')).toHaveText("51");
  await expect(panel.locator('[data-metric="namedLogicalNodes"]')).toHaveText("29");
  await expect(panel.locator('[data-metric="semanticComponents"]')).toHaveText("19");
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${SCREENSHOTS}/w1-debug-mode.png` });
});

test("debug UI is absent in product mode", async ({ page }) => {
  const errors = await openRuntime(page);
  await expect(page.locator(".debug-panel")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("failed GLB load shows a readable error and retry recovers", async ({ page }) => {
  await page.route("**/pc_anatomy_web_final.glb", (route) => route.abort("failed"));
  await page.goto("/");
  await page.waitForFunction(() => window.pcAnatomy?.getState().status === "error");
  await expect(page.locator("#runtime-status")).toBeVisible();
  await expect(page.locator("#status-message")).toContainText("could not be prepared");
  await expect(page.locator("#retry-button")).toBeVisible();

  await page.unroute("**/pc_anatomy_web_final.glb");
  await page.locator("#retry-button").click();
  await page.waitForFunction(() => window.pcAnatomy?.getState().status === "ready");
  await expect(page.locator("#runtime-status")).toBeHidden();
});
