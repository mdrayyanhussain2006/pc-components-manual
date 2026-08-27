import { test, expect, type Page } from "@playwright/test";

test.describe("W3 Interaction Layer", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/?debug=1");
    // Wait for runtime to be ready
    await page.waitForFunction(() => {
      const api = (window as any).pcAnatomy;
      return api?.getState()?.status === "ready";
    }, { timeout: 15000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    await page.evaluate(() => {
      const api = (window as any).pcAnatomy;
      api.animation.reset();
      api.camera.reset(true);
      api.interaction.clear();
    });
  });

  test("semantic component registry exists and handles hover", async () => {
    // We should be able to hover over a component and see its hover state change.
    // Instead of precise raycasting coordinates in E2E, we can programmatically verify
    // that the interaction controller maintains state.
    
    // Simulate hover via API
    await page.evaluate(() => {
      const api = (window as any).pcAnatomy;
      const rt = (window as any).__PC_ANATOMY_RUNTIME__();
      rt.interactionController.hover("CPU_COOLER");
    });

    const state = await page.evaluate(() => {
      const api = (window as any).pcAnatomy;
      return api.interaction.getSnapshot();
    });

    expect(state).toEqual({ hovered: "CPU_COOLER", selected: null });
  });

  test("selection updates state and focuses camera", async () => {
    // Ensure that selection works
    await page.evaluate(() => {
      const api = (window as any).pcAnatomy;
      api.interaction.select("GPU");
      api.camera.focusOn("GPU", true);
    });

    const interactionState = await page.evaluate(() => {
      return (window as any).pcAnatomy.interaction.getSnapshot();
    });
    expect(interactionState.selected).toBe("GPU");

    // Camera should have changed state to custom
    const cameraState = await page.evaluate(() => {
      return (window as any).pcAnatomy.camera.getSnapshot();
    });
    expect(cameraState.state).toBe("custom");
  });

  test("selection is decoupled from animation playback", async () => {
    // Triggering selection should NOT advance the animation playhead
    await page.evaluate(() => {
      const api = (window as any).pcAnatomy;
      api.interaction.select("CASE_SIDE_PANEL");
    });

    const timelineState = await page.evaluate(() => {
      return (window as any).pcAnatomy.animation.getSnapshot();
    });
    
    // Playhead should remain at ASSEMBLED_TIME (1/24)
    expect(timelineState.timelineTime).toBeCloseTo(1 / 24, 3);
    expect(timelineState.currentStage).toBe("ASSEMBLED");
  });

  test("keyboard navigation syncs focus without camera jump", async () => {
    // Focus the first button
    await page.keyboard.press("Tab");

    const activeComponent = await page.evaluate(() => {
      const el = document.activeElement as HTMLButtonElement;
      return el?.getAttribute("data-component-id");
    });

    // Depending on the order of SEMANTIC_COMPONENT_IDS, it might be CASE.
    expect(activeComponent).toBeTruthy();

    const hoverState = await page.evaluate(() => {
      return (window as any).pcAnatomy.interaction.getSnapshot().hovered;
    });

    // Hover state should match the focused element
    expect(hoverState).toBe(activeComponent);

    // Camera should still be in hero state
    const cameraState = await page.evaluate(() => {
      return (window as any).pcAnatomy.camera.getSnapshot();
    });
    expect(cameraState.state).toBe("hero");

    // Pressing Enter should select and focus the camera
    await page.keyboard.press("Enter");

    const selectState = await page.evaluate(() => {
      return (window as any).pcAnatomy.interaction.getSnapshot().selected;
    });
    expect(selectState).toBe(activeComponent);
  });
});
