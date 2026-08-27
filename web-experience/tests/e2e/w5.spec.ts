import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?debug=1");
  await page.waitForFunction(
    () => window.pcAnatomy?.getState()?.status === "ready",
    undefined,
    { timeout: 30000 },
  );
});

test.describe("W5: Product Shell & Header", () => {
  test("displays the product title and subtitle in the header", async ({ page }) => {
    const title = page.locator(".product-title");
    const subtitle = page.locator(".product-subtitle");
    await expect(title).toHaveText("PC Anatomy");
    await expect(subtitle).toHaveText("Interactive Technical Visualization");
  });

  test("fades the header when a component is selected and restores on clear", async ({ page }) => {
    const header = page.locator("#product-header");
    await expect(header).not.toHaveClass(/product-header--faded/);

    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));
    await expect(header).toHaveClass(/product-header--faded/);

    await page.evaluate(() => window.pcAnatomy?.interaction.clear());
    await expect(header).not.toHaveClass(/product-header--faded/);
  });
});

test.describe("W5: Stage Navigation", () => {
  test("renders 11 stage dots in correct sequence", async ({ page }) => {
    const dots = page.locator(".stage-nav__dot");
    await expect(dots).toHaveCount(11);

    const firstDot = dots.first();
    await expect(firstDot).toHaveAttribute("data-stage", "ASSEMBLED");
    await expect(firstDot).toHaveClass(/stage-nav__dot--active/);

    const lastDot = dots.last();
    await expect(lastDot).toHaveAttribute("data-stage", "FINAL_EXPLODE");
  });

  test("clicking a stage dot triggers playStage directly", async ({ page }) => {
    const gpuDot = page.locator('.stage-nav__dot[data-stage="GPU_OUT"]');
    await gpuDot.click();

    await page.waitForFunction(
      () => window.pcAnatomy?.animation.getSnapshot()?.targetStage === "GPU_OUT" ||
            window.pcAnatomy?.animation.getSnapshot()?.currentStage === "GPU_OUT",
      undefined,
      { timeout: 5000 },
    );

    const snapshot = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(snapshot?.targetStage === "GPU_OUT" || snapshot?.currentStage === "GPU_OUT").toBe(true);
  });
});

test.describe("W5: Playback Controls", () => {
  test("next and prev buttons advance and step back stages", async ({ page }) => {
    const nextBtn = page.locator("#playback-next");
    const prevBtn = page.locator("#playback-prev");

    await nextBtn.click();
    await page.waitForFunction(
      () => window.pcAnatomy?.animation.getSnapshot()?.currentStage === "OPEN_CASE" ||
            window.pcAnatomy?.animation.getSnapshot()?.targetStage === "OPEN_CASE",
      undefined,
      { timeout: 5000 },
    );

    await prevBtn.click();
    await page.waitForFunction(
      () => window.pcAnatomy?.animation.getSnapshot()?.currentStage === "ASSEMBLED" ||
            window.pcAnatomy?.animation.getSnapshot()?.targetStage === "ASSEMBLED",
      undefined,
      { timeout: 5000 },
    );
  });

  test("reset button returns to ASSEMBLED, clears selection and camera", async ({ page }) => {
    await page.evaluate(() => {
      window.pcAnatomy?.interaction.select("GPU");
      window.pcAnatomy?.animation.playStage("GPU_OUT");
    });

    const resetBtn = page.locator("#playback-reset");
    await resetBtn.click();

    await page.waitForFunction(
      () => window.pcAnatomy?.animation.getSnapshot()?.currentStage === "ASSEMBLED" &&
            window.pcAnatomy?.interaction.getSnapshot()?.selected === null,
      undefined,
      { timeout: 5000 },
    );

    const isEduHidden = await page.locator("#education-panel").isHidden();
    expect(isEduHidden).toBe(true);
  });
});

test.describe("W5: Education Panel Refinements & Progressive Disclosure", () => {
  test("uses human-readable component display names in connection chips", async ({ page }) => {
    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));

    const panel = page.locator("#education-panel");
    await expect(panel).toBeVisible();

    const chips = panel.locator(".edu-chip-label");
    const count = await chips.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const text = await chips.nth(i).textContent();
      expect(text).toBeTruthy();
      expect(text).not.toContain("_"); // No raw IDs with underscores
    }
  });

  test("uses human-readable stage name on the disassembly button", async ({ page }) => {
    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));

    const disBtn = page.locator(".edu-btn-disassemble");
    await expect(disBtn).toBeVisible();
    await expect(disBtn).toHaveText(/Remove Graphics Card/);
    await expect(disBtn).not.toHaveText(/GPU_OUT/);
  });

  test("progressive disclosure: details are collapsed initially and expand on toggle", async ({ page }) => {
    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));

    const toggle = page.locator(".edu-details-toggle");
    const detailsBody = page.locator("#edu-details-body");

    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(detailsBody).not.toHaveClass(/edu-details-body--open/);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(detailsBody).toHaveClass(/edu-details-body--open/);
  });
});

test.describe("W5: Persistence & Global State Management", () => {
  test("preserves component selection during component-specific disassembly", async ({ page }) => {
    await page.evaluate(() => {
      window.pcAnatomy?.interaction.select("GPU");
      window.pcAnatomy?.education.disassemble("GPU");
    });

    // Wait 1 second mid-animation
    await page.waitForTimeout(1000);

    const snapshot = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(snapshot?.selected).toBe("GPU");

    const panelVisible = await page.locator("#education-panel").isVisible();
    expect(panelVisible).toBe(true);
  });

  test("clears component selection and education when entering FINAL_EXPLODE", async ({ page }) => {
    await page.evaluate(() => {
      window.pcAnatomy?.interaction.select("GPU");
      window.pcAnatomy?.animation.playStage("FINAL_EXPLODE");
    });

    await page.waitForFunction(
      () => window.pcAnatomy?.interaction.getSnapshot()?.selected === null,
      undefined,
      { timeout: 5000 },
    );

    const panelHidden = await page.locator("#education-panel").isHidden();
    expect(panelHidden).toBe(true);
  });
});

test.describe("W5: Camera Focus Profiles", () => {
  test("focuses with component-specific profiles for GPU vs Motherboard", async ({ page }) => {
    await page.evaluate(() => window.pcAnatomy?.camera.focusOn("GPU", true));
    const gpuCam = await page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());

    await page.evaluate(() => window.pcAnatomy?.camera.focusOn("MOTHERBOARD", true));
    const mbCam = await page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());

    expect(gpuCam).not.toBeNull();
    expect(mbCam).not.toBeNull();

    // Target positions and camera positions should differ
    expect(gpuCam?.position).not.toEqual(mbCam?.position);
    expect(gpuCam?.target).not.toEqual(mbCam?.target);
  });
});

test.describe("W5: Responsive Behavior", () => {
  test("tablet viewport (768x1024) limits education panel width to <= 280px", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));

    const panel = page.locator("#education-panel");
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(280);
  });

  test("mobile viewport (375x812) collapses bottom sheet and hides product header", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const header = page.locator("#product-header");
    await expect(header).toBeHidden();

    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));
    const panel = page.locator("#education-panel");
    await expect(panel).toBeVisible();

    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    // Mobile panel is positioned at bottom and should not take more than 50% viewport height
    expect(box!.height).toBeLessThanOrEqual(812 * 0.5);
  });
});
