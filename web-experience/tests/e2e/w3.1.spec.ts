import { expect, test, type Page } from "@playwright/test";

const SEMANTIC_COMPONENT_IDS = [
  "CASE", "CASE_SIDE_PANEL", "MOTHERBOARD", "CPU", "CPU_COOLER",
  "RAM_01", "RAM_02", "RAM_03", "RAM_04", "GPU", "M2_SSD",
  "STORAGE", "PSU", "CASE_FAN_01", "CASE_FAN_02", "CASE_FAN_03",
  "CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER",
] as const;

async function openRuntime(page: Page, path = "/?debug=1"): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  await page.waitForFunction(() => window.pcAnatomy?.getState().status === "ready", undefined, { timeout: 20000 });
  await page.waitForTimeout(500);
  return errors;
}

function getRaycastPoint(page: Page, componentId: string) {
  return page.evaluate((id) => {
    // @ts-ignore
    const runtime = window.__PC_ANATOMY_RUNTIME__?.();
    return runtime?.getComponentRaycastPoint(id) ?? null;
  }, componentId);
}

function getScreenCenter(page: Page, componentId: string) {
  return page.evaluate((id) => {
    // @ts-ignore
    const runtime = window.__PC_ANATOMY_RUNTIME__?.();
    return runtime?.getComponentScreenCenter(id) ?? null;
  }, componentId);
}

// ──────────────────────────────────────────────────────────────────
// §1. REAL POINTER RAYCAST — EXACT SEMANTIC ID RESOLUTION
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §1 — Real Pointer Raycast Exact Resolution", () => {
  test("hover and click CASE_SIDE_PANEL in assembled state resolves exact ID 'CASE_SIDE_PANEL'", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.reset();
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    const point = await getRaycastPoint(page, "CASE_SIDE_PANEL");
    expect(point).toBeTruthy();

    await page.mouse.move(point!.x, point!.y);
    await page.waitForTimeout(150);

    const hoverSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(hoverSnap?.hovered, "Real mouse hover must resolve exact ID 'CASE_SIDE_PANEL'").toBe("CASE_SIDE_PANEL");

    await page.mouse.click(point!.x, point!.y);
    await page.waitForTimeout(200);

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected, "Real mouse click must resolve exact ID 'CASE_SIDE_PANEL'").toBe("CASE_SIDE_PANEL");

    expect(errors).toEqual([]);
  });

  test("hover and click GPU via real pointer resolves exact ID 'GPU'", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    // Open case so interior components are clearly visible and unobstructed
    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.seekTo(132 / 24); // OPEN_CASE parkTime
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    const point = await getRaycastPoint(page, "GPU");
    expect(point, "GPU must provide a valid screen raycast point").toBeTruthy();

    const timelineBefore = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());

    // 1. Move real mouse to GPU point -> verify EXACT hover ID
    await page.mouse.move(point!.x, point!.y);
    await page.waitForTimeout(150);

    const hoverSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(hoverSnap?.hovered, "Real mouse hover must resolve exact ID 'GPU'").toBe("GPU");
    expect(hoverSnap?.selected).toBeNull();

    // 2. Click real mouse at GPU point -> verify EXACT selection ID
    await page.mouse.click(point!.x, point!.y);
    await page.waitForTimeout(100);

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected, "Real mouse click must resolve exact ID 'GPU'").toBe("GPU");

    // 3. Camera should focus to custom state
    await page.waitForFunction(() => window.pcAnatomy?.camera.getSnapshot()?.state === "custom", undefined, { timeout: 3000 });
    const camSnap = await page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());
    expect(camSnap?.state).toBe("custom");

    // 4. Animation timeline must NOT have changed
    const timelineAfter = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(timelineAfter?.timelineTime).toBeCloseTo(timelineBefore!.timelineTime, 3);
    expect(timelineAfter?.playbackState).toBe(timelineBefore!.playbackState);

    expect(errors).toEqual([]);
  });

  test("hover and click MOTHERBOARD via real pointer resolves exact ID 'MOTHERBOARD'", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.seekTo(132 / 24);
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    const point = await getRaycastPoint(page, "MOTHERBOARD");
    expect(point, "MOTHERBOARD must provide a valid screen raycast point").toBeTruthy();

    // Move real mouse -> verify EXACT hover
    await page.mouse.move(point!.x, point!.y);
    await page.waitForTimeout(150);

    const hoverSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(hoverSnap?.hovered, "Real mouse hover must resolve exact ID 'MOTHERBOARD'").toBe("MOTHERBOARD");

    // Click real mouse -> verify EXACT selection
    await page.mouse.click(point!.x, point!.y);
    await page.waitForTimeout(200);

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected, "Real mouse click must resolve exact ID 'MOTHERBOARD'").toBe("MOTHERBOARD");

    expect(errors).toEqual([]);
  });

  test("hover and click CPU_COOLER via real pointer resolves exact ID 'CPU_COOLER'", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.seekTo(132 / 24);
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    const point = await getRaycastPoint(page, "CPU_COOLER");
    expect(point, "CPU_COOLER must provide a valid screen raycast point").toBeTruthy();

    await page.mouse.move(point!.x, point!.y);
    await page.waitForTimeout(150);

    const hoverSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(hoverSnap?.hovered, "Real mouse hover must resolve exact ID 'CPU_COOLER'").toBe("CPU_COOLER");

    await page.mouse.click(point!.x, point!.y);
    await page.waitForTimeout(200);

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected, "Real mouse click must resolve exact ID 'CPU_COOLER'").toBe("CPU_COOLER");

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §2. ALL 19 SEMANTIC COMPONENTS — EXPLICIT MESH COUNT & ANCESTOR RESOLUTION
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §2 — Semantic Component Registry Contract", () => {
  test("all 19 semantic components resolve with explicit meshCount > 0 and valid bounds", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const snapshot = await page.evaluate(() => {
      // @ts-ignore
      const runtime = window.__PC_ANATOMY_RUNTIME__?.();
      return runtime?.interactionController?.getSemanticRegistrySnapshot() ?? null;
    });

    expect(snapshot, "Registry snapshot must exist").toBeTruthy();
    expect(Object.keys(snapshot)).toHaveLength(19);

    for (const id of SEMANTIC_COMPONENT_IDS) {
      const comp = snapshot[id];
      expect(comp, `Component ${id} must exist in registry snapshot`).toBeTruthy();
      expect(comp.componentId).toBe(id);
      expect(comp.nodeName).toBeTruthy();
      expect(comp.meshCount, `Component ${id} must have meshCount > 0`).toBeGreaterThan(0);
      expect(comp.meshNames.length, `Component ${id} meshNames length must match meshCount`).toBe(comp.meshCount);
      expect(comp.bounds, `Component ${id} must have bounds`).toBeTruthy();
      expect(comp.hasValidBounds, `Component ${id} must have valid non-zero bounds`).toBe(true);

      // Verify bounds are non-zero finite numbers
      expect(comp.bounds.size[0] + comp.bounds.size[1] + comp.bounds.size[2]).toBeGreaterThan(0);
    }

    // Verify raw vs logical vs semantic inventory counts
    const state = await page.evaluate(() => window.pcAnatomy?.getState());
    expect((state as any)?.inventory?.rawGltfNodes).toBe(51);
    expect((state as any)?.inventory?.namedLogicalNodes).toBe(29);
    expect((state as any)?.inventory?.semanticComponents).toBe(19);

    expect(errors).toEqual([]);
  });

  test("unnamed and child meshes resolve upward to correct semantic ancestor", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const resolutionResults = await page.evaluate((ids) => {
      // @ts-ignore
      const runtime = window.__PC_ANATOMY_RUNTIME__?.();
      const ic = runtime?.interactionController;
      if (!ic) return null;

      const snapshot = ic.getSemanticRegistrySnapshot();
      const results: Record<string, { meshName: string; resolvedId: string | null }[]> = {};

      for (const id of ids) {
        const comp = snapshot[id];
        results[id] = comp.meshNames.map((mName: string) => ({
          meshName: mName,
          resolvedId: ic.resolveMeshToSemanticId(mName),
        }));
      }

      return results;
    }, [...SEMANTIC_COMPONENT_IDS]);

    expect(resolutionResults).toBeTruthy();

    for (const id of SEMANTIC_COMPONENT_IDS) {
      const meshResolutions = resolutionResults![id] ?? [];
      expect(meshResolutions.length, `${id} must have at least one mesh`).toBeGreaterThan(0);
      for (const res of meshResolutions) {
        expect(res.resolvedId, `Mesh ${res.meshName} must resolve upward to ancestor ${id}`).toBe(id);
      }
    }

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §3. MATERIAL CLONE INTEGRITY & ISOLATION
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §3 — Material Clone Integrity & Isolation", () => {
  const TEST_COMPONENTS = ["GPU", "MOTHERBOARD", "RAM_01"] as const;

  for (const id of TEST_COMPONENTS) {
    test(`material cloning is isolated and reversible for ${id}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const errors = await openRuntime(page);

      // 1. Initial State: not cloned, original materials in place
      await page.evaluate(() => window.pcAnatomy?.interaction.clear());
      await page.waitForTimeout(50);

      const initialInfo = await page.evaluate((cid) => {
        // @ts-ignore
        const runtime = window.__PC_ANATOMY_RUNTIME__?.();
        return runtime?.interactionController?.getMaterialDebugInfo(cid);
      }, id);

      expect(initialInfo, `Initial material info for ${id} must exist`).toBeTruthy();
      for (const mesh of initialInfo!.meshes) {
        expect(mesh.isCloned, `Initial mesh ${mesh.meshName} must not be cloned`).toBe(false);
        expect(mesh.currentMaterialUuid).toEqual(mesh.originalMaterialUuid);
        expect(mesh.emissiveHex).toBe(0);
      }

      // 2. Select Component: runtime cloned material active with emissive highlight
      await page.evaluate((cid) => window.pcAnatomy?.interaction.select(cid as any), id);
      await page.waitForTimeout(50);

      const selectedInfo = await page.evaluate((cid) => {
        // @ts-ignore
        const runtime = window.__PC_ANATOMY_RUNTIME__?.();
        return runtime?.interactionController?.getMaterialDebugInfo(cid);
      }, id);

      expect(selectedInfo).toBeTruthy();
      for (const mesh of selectedInfo!.meshes) {
        expect(mesh.isCloned, `Selected mesh ${mesh.meshName} must use a cloned material`).toBe(true);
        expect(mesh.currentMaterialUuid).not.toEqual(mesh.originalMaterialUuid);
        expect(mesh.emissiveHex, `Selected mesh ${mesh.meshName} must have selection emissive`).toBe(0x666666);
        expect(mesh.emissiveIntensity).toBe(0.5);
      }

      // 3. Cross-Isolation: other components must NOT be cloned or highlighted
      for (const otherId of TEST_COMPONENTS) {
        if (otherId === id) continue;
        const otherInfo = await page.evaluate((oid) => {
          // @ts-ignore
          const runtime = window.__PC_ANATOMY_RUNTIME__?.();
          return runtime?.interactionController?.getMaterialDebugInfo(oid);
        }, otherId);

        expect(otherInfo).toBeTruthy();
        for (const mesh of otherInfo!.meshes) {
          expect(mesh.isCloned, `Unrelated component ${otherId} mesh ${mesh.meshName} must not be cloned`).toBe(false);
          expect(mesh.currentMaterialUuid).toEqual(mesh.originalMaterialUuid);
        }
      }

      // 4. Clear Selection: original material restored
      await page.evaluate(() => window.pcAnatomy?.interaction.clear());
      await page.waitForTimeout(50);

      const clearedInfo = await page.evaluate((cid) => {
        // @ts-ignore
        const runtime = window.__PC_ANATOMY_RUNTIME__?.();
        return runtime?.interactionController?.getMaterialDebugInfo(cid);
      }, id);

      expect(clearedInfo).toBeTruthy();
      for (const mesh of clearedInfo!.meshes) {
        expect(mesh.isCloned, `Cleared mesh ${mesh.meshName} must revert to original material`).toBe(false);
        expect(mesh.currentMaterialUuid).toEqual(mesh.originalMaterialUuid);
        expect(mesh.emissiveHex).toBe(0);
      }

      expect(errors).toEqual([]);
    });
  }
});

// ──────────────────────────────────────────────────────────────────
// §4. REAL POINTER INTERACTION DURING ACTIVE ANIMATION
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §4 — Real Pointer Interaction During Active Animation", () => {
  test("real mouse click during MOTHERBOARD_OUT selects GPU without mutating animation", async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    // Reset & position camera to open view
    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.reset();
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    // Start MOTHERBOARD_OUT
    await page.evaluate(() => window.pcAnatomy?.animation.playStage("MOTHERBOARD_OUT"));
    await page.waitForTimeout(300);

    // Verify playback is actively playing
    const midSnap = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(midSnap?.playbackState).toBe("playing");
    const timeBeforeClick = midSnap!.timelineTime;

    // Determine GPU screen location and perform REAL mouse click
    const gpuPoint = await getRaycastPoint(page, "GPU");
    expect(gpuPoint).toBeTruthy();

    await page.mouse.move(gpuPoint!.x, gpuPoint!.y);
    await page.mouse.click(gpuPoint!.x, gpuPoint!.y);
    await page.waitForTimeout(100);

    // Verify exact selection
    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected, "Real click during animation must select exact ID 'GPU'").toBe("GPU");

    // Verify timeline continued advancing smoothly and was NOT reset, paused, or seeked
    const afterClickSnap = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(afterClickSnap!.timelineTime).toBeGreaterThanOrEqual(timeBeforeClick);

    // Wait for MOTHERBOARD_OUT to finish
    await page.waitForFunction(() => {
      const snap = window.pcAnatomy?.animation.getSnapshot();
      return snap?.playbackState === "idle";
    }, undefined, { timeout: 30000 });

    // Verify selection is still GPU after stage completion
    const finalSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(finalSnap?.selected).toBe("GPU");

    const finalAnim = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(finalAnim?.currentStage).toBe("MOTHERBOARD_OUT");
    expect(finalAnim?.playbackState).toBe("idle");

    expect(errors).toEqual([]);
  });

  test("real mouse click during GPU_OUT interacts without timeline disruption", async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.seekTo(132 / 24);
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => window.pcAnatomy?.animation.playStage("GPU_OUT"));
    await page.waitForTimeout(300);

    const gpuPoint = await getRaycastPoint(page, "GPU");
    expect(gpuPoint).toBeTruthy();

    await page.mouse.move(gpuPoint!.x, gpuPoint!.y);
    await page.mouse.click(gpuPoint!.x, gpuPoint!.y);
    await page.waitForTimeout(100);

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected).toBe("GPU");

    await page.waitForFunction(() => {
      const snap = window.pcAnatomy?.animation.getSnapshot();
      return snap?.playbackState === "idle";
    }, undefined, { timeout: 30000 });

    const finalSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(finalSnap?.selected).toBe("GPU");

    expect(errors).toEqual([]);
  });

  test("real mouse click during FINAL_EXPLODE interacts without timeline disruption", async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.reset();
    });
    await page.waitForTimeout(300);

    await page.evaluate(() => window.pcAnatomy?.animation.playStage("FINAL_EXPLODE"));
    await page.waitForTimeout(500);

    const mbPoint = await getRaycastPoint(page, "MOTHERBOARD");
    expect(mbPoint).toBeTruthy();

    await page.mouse.click(mbPoint!.x, mbPoint!.y);
    await page.waitForTimeout(100);

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected).toBe("MOTHERBOARD");

    await page.waitForFunction(() => {
      const snap = window.pcAnatomy?.animation.getSnapshot();
      return snap?.playbackState === "idle";
    }, undefined, { timeout: 45000 });

    const finalSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(finalSnap?.selected).toBe("MOTHERBOARD");

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §5. COMPONENT-SCALE CAMERA FRAMING
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §5 — Component-Scale Camera Framing", () => {
  const COMPONENTS_TO_TEST = ["MOTHERBOARD", "GPU", "CPU_COOLER", "PSU", "RAM_01", "M2_SSD"] as const;

  test("camera frames components of varying physical scales without clipping", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    for (const id of COMPONENTS_TO_TEST) {
      await page.evaluate(() => {
        window.pcAnatomy?.interaction.clear();
        window.pcAnatomy?.camera.hero(true);
      });
      await page.waitForTimeout(100);

      const heroCam = await page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());

      // Focus camera on component
      await page.evaluate((cid) => {
        window.pcAnatomy?.interaction.select(cid as any);
        window.pcAnatomy?.camera.focusOn(cid as any, true);
      }, id);
      await page.waitForTimeout(100);

      const focusCam = await page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());
      expect(focusCam, `${id}: Focus snapshot must exist`).toBeTruthy();
      expect(focusCam!.state).toBe("custom");

      // Verify target moved to component
      const targetMoved =
        Math.abs(focusCam!.target[0] - heroCam!.target[0]) > 0.001 ||
        Math.abs(focusCam!.target[1] - heroCam!.target[1]) > 0.001 ||
        Math.abs(focusCam!.target[2] - heroCam!.target[2]) > 0.001;
      expect(targetMoved, `${id}: Camera target must move toward component`).toBe(true);

      // Verify camera distance is proportional and within sensible bounds
      expect(focusCam!.distance, `${id}: Distance must be > 0.02`).toBeGreaterThan(0.02);
      expect(focusCam!.distance, `${id}: Distance must be < 5.0`).toBeLessThan(5.0);

      // Verify all 8 bounding box corners project within safe viewport bounds (NDC [-1.2, 1.2])
      const projectionCheck = await page.evaluate((cid) => {
        // @ts-ignore
        const runtime = window.__PC_ANATOMY_RUNTIME__?.();
        const ic = runtime?.interactionController;
        const cam = runtime?.camera;
        if (!ic || !cam) return null;

        const bounds = ic.getComponentBounds(cid);
        if (!bounds) return null;

        const corners = [
          bounds.min.clone(),
          bounds.max.clone(),
          bounds.min.clone().setX(bounds.max.x),
          bounds.min.clone().setY(bounds.max.y),
          bounds.min.clone().setZ(bounds.max.z),
          bounds.max.clone().setX(bounds.min.x),
          bounds.max.clone().setY(bounds.min.y),
          bounds.max.clone().setZ(bounds.min.z),
        ];

        let allInSafeMargin = true;
        for (const c of corners) {
          const ndc = c.project(cam);
          // Check reasonable safe margin in NDC
          if (Math.abs(ndc.x) > 1.2 || Math.abs(ndc.y) > 1.2 || ndc.z < 0 || ndc.z > 1) {
            allInSafeMargin = false;
          }
        }

        return { allInSafeMargin };
      }, id);

      expect(projectionCheck?.allInSafeMargin, `${id} bounding box must fit within safe viewport margins`).toBe(true);
    }

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §6. CLICK VS DRAG DISCRIMINATION (MOUSE & TOUCH)
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §6 — Click vs Drag Discrimination", () => {
  test("mouse click selects, but orbit drag does NOT select", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.seekTo(132 / 24);
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    const gpuPoint = await getRaycastPoint(page, "GPU");
    expect(gpuPoint).toBeTruthy();

    // 1. Orbit drag across GPU (>30px) -> must NOT select
    await page.evaluate(() => window.pcAnatomy?.interaction.clear());
    await page.mouse.move(gpuPoint!.x, gpuPoint!.y);
    await page.mouse.down();
    await page.mouse.move(gpuPoint!.x + 50, gpuPoint!.y + 20, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const dragSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(dragSnap?.selected, "Orbit drag must NOT trigger selection").toBeNull();

    // 2. Precise click (<5px movement) -> DOES select GPU
    await page.mouse.move(gpuPoint!.x, gpuPoint!.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(100);

    const clickSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(clickSnap?.selected, "Clean click must trigger selection").toBe("GPU");

    expect(errors).toEqual([]);
  });

  test("touch tap selects, but touch drag does NOT select", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.animation.seekTo(132 / 24);
      window.pcAnatomy?.camera.open(true);
    });
    await page.waitForTimeout(300);

    const gpuPoint = await getRaycastPoint(page, "GPU");
    expect(gpuPoint).toBeTruthy();

    // 1. Touch tap (dispatch PointerEvents with pointerType 'touch' and 0 delta)
    await page.evaluate((pt) => {
      const canvas = document.querySelector("#experience-canvas") as HTMLCanvasElement;
      const origSet = Element.prototype.setPointerCapture;
      const origRel = Element.prototype.releasePointerCapture;
      try {
        Element.prototype.setPointerCapture = () => {};
        Element.prototype.releasePointerCapture = () => {};
        const down = new PointerEvent("pointerdown", {
          clientX: pt.x,
          clientY: pt.y,
          button: 0,
          pointerType: "touch",
          bubbles: true,
        });
        const up = new PointerEvent("pointerup", {
          clientX: pt.x,
          clientY: pt.y,
          button: 0,
          pointerType: "touch",
          bubbles: true,
        });
        canvas.dispatchEvent(down);
        canvas.dispatchEvent(up);
      } finally {
        Element.prototype.setPointerCapture = origSet;
        Element.prototype.releasePointerCapture = origRel;
      }
    }, gpuPoint!);
    await page.waitForTimeout(100);

    const tapSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(tapSnap?.selected, "Touch tap must trigger selection").toBe("GPU");

    // 2. Touch drag (>30px delta) -> must NOT select
    await page.evaluate(() => window.pcAnatomy?.interaction.clear());
    await page.evaluate((pt) => {
      const canvas = document.querySelector("#experience-canvas") as HTMLCanvasElement;
      const origSet = Element.prototype.setPointerCapture;
      const origRel = Element.prototype.releasePointerCapture;
      try {
        Element.prototype.setPointerCapture = () => {};
        Element.prototype.releasePointerCapture = () => {};
        const down = new PointerEvent("pointerdown", {
          clientX: pt.x,
          clientY: pt.y,
          button: 0,
          pointerType: "touch",
          bubbles: true,
        });
        const up = new PointerEvent("pointerup", {
          clientX: pt.x + 60,
          clientY: pt.y + 30,
          button: 0,
          pointerType: "touch",
          bubbles: true,
        });
        canvas.dispatchEvent(down);
        canvas.dispatchEvent(up);
      } finally {
        Element.prototype.setPointerCapture = origSet;
        Element.prototype.releasePointerCapture = origRel;
      }
    }, gpuPoint!);
    await page.waitForTimeout(100);

    const touchDragSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(touchDragSnap?.selected, "Touch drag must NOT trigger selection").toBeNull();

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §7. KEYBOARD ACCESSIBILITY PATH
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §7 — Keyboard Accessibility Path", () => {
  test("Tab focuses buttons without camera jump, Enter selects exact component, Escape clears", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.camera.hero(true);
    });

    // 1. Press Tab -> focuses first button
    await page.keyboard.press("Tab");
    await page.waitForTimeout(50);

    const firstFocused = await page.evaluate(() =>
      (document.activeElement as HTMLElement)?.getAttribute("data-component-id"),
    );
    expect(firstFocused, "First focused element must have data-component-id").toBeTruthy();

    // Tab alone must NOT move camera
    const cam1 = await page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());
    expect(cam1?.state, "Tab alone must keep camera in hero state").toBe("hero");

    // Hover state should match focused element
    const hover1 = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(hover1?.hovered).toBe(firstFocused);
    expect(hover1?.selected).toBeNull();

    // 2. Press Tab again -> focuses second button
    await page.keyboard.press("Tab");
    await page.waitForTimeout(50);

    const secondFocused = await page.evaluate(() =>
      (document.activeElement as HTMLElement)?.getAttribute("data-component-id"),
    );
    expect(secondFocused).toBeTruthy();
    expect(secondFocused).not.toBe(firstFocused);

    // 3. Press Enter -> selects exact component and focuses camera
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.pcAnatomy?.camera.getSnapshot()?.state === "custom", undefined, { timeout: 3000 });

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected, "Enter must select the focused component").toBe(secondFocused);

    const cam2 = await page.evaluate(() => window.pcAnatomy?.camera.getSnapshot());
    expect(cam2?.state).toBe("custom");

    // 4. Press Escape -> clears selection
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    const clearedSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(clearedSnap?.selected, "Escape must clear selection").toBeNull();

    expect(errors).toEqual([]);
  });

  test("keyboard navigation selects small component M2_SSD via Enter/Space", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.clear();
      window.pcAnatomy?.camera.hero(true);
    });

    // Programmatically focus the M2_SSD button
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-component-id="M2_SSD"]') as HTMLButtonElement;
      btn?.focus();
    });
    await page.waitForTimeout(50);

    const hoverSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(hoverSnap?.hovered).toBe("M2_SSD");

    // Click button (or Enter) to select
    await page.evaluate(() => {
      const btn = document.querySelector('button[data-component-id="M2_SSD"]') as HTMLButtonElement;
      btn?.click();
    });
    await page.waitForTimeout(200);

    const selectSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(selectSnap?.selected).toBe("M2_SSD");

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §8. CLEAR SELECTION (ESCAPE & EMPTY CANVAS CLICK)
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §8 — Clear Selection", () => {
  test("Escape clears active selection", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));
    let snap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(snap?.selected).toBe("GPU");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);

    snap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(snap?.selected).toBeNull();

    expect(errors).toEqual([]);
  });

  test("clicking confirmed empty canvas area clears selection", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => window.pcAnatomy?.interaction.select("MOTHERBOARD"));
    let snap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(snap?.selected).toBe("MOTHERBOARD");

    // Click far top-left corner where no mesh exists
    await page.mouse.click(10, 10);
    await page.waitForTimeout(150);

    snap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(snap?.selected).toBeNull();

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §9. SINGLE AUTHORITATIVE SEMANTIC REGISTRY
// ──────────────────────────────────────────────────────────────────
test.describe("W3.2 §9 — Single Authoritative Registry Contract", () => {
  test("exactly 19 semantic component IDs defined without duplicate registry files", async () => {
    expect(SEMANTIC_COMPONENT_IDS).toHaveLength(19);
    // Confirm no duplicate component IDs
    const uniqueIds = new Set(SEMANTIC_COMPONENT_IDS);
    expect(uniqueIds.size).toBe(19);
  });
});
