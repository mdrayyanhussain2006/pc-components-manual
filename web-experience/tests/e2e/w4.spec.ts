import { test, expect, type Page } from "@playwright/test";
import { SEMANTIC_COMPONENT_IDS } from "../../src/runtime/core/types";
import stagesConfig from "../../../build/animation_stages.json" assert { type: "json" };

const KNOWN_STAGE_IDS = stagesConfig.stages.map((s: { id: string }) => s.id);

async function openRuntime(page: Page): Promise<string[]> {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto("/?debug=1");
  await page.waitForFunction(() => {
    const api = window.pcAnatomy;
    return api?.getState()?.status === "ready";
  }, undefined, { timeout: 30000 });

  return consoleErrors;
}

// ──────────────────────────────────────────────────────────────────
// §1. SELECTION DECOUPLING
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §1 — Selection Decoupling from Animation", () => {
  test("selecting any component does not alter timelineTime or playbackState", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const initialAnim = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(initialAnim?.playbackState).toBe("idle");

    for (const cid of ["GPU", "MOTHERBOARD", "CPU", "RAM_01", "PSU"] as const) {
      await page.evaluate((id) => window.pcAnatomy?.interaction.select(id), cid);
      await page.waitForTimeout(50);

      const animSnap = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
      expect(animSnap?.timelineTime, `${cid}: timelineTime must not change on select`).toBeCloseTo(initialAnim!.timelineTime, 3);
      expect(animSnap?.playbackState, `${cid}: playbackState must remain idle`).toBe("idle");
    }

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §2. DISASSEMBLY ACTION SEMANTICS & COHERENCE
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §2 — Disassembly Action Semantics & Coherence", () => {
  test("select -> education -> Disassemble -> animation keeps educational context coherent throughout animation", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    // 1. Select GPU
    await page.evaluate(() => {
      window.pcAnatomy?.interaction.select("GPU");
    });
    await page.waitForTimeout(100);

    const preSnap = await page.evaluate(() => window.pcAnatomy?.education.getSnapshot());
    expect(preSnap?.selectedComponent).toBe("GPU");
    expect(preSnap?.content?.displayName).toContain("Graphics Processing Unit");

    // 2. Trigger Disassemble for GPU
    await page.evaluate(() => window.pcAnatomy?.education.disassemble("GPU"));
    await page.waitForTimeout(200);

    // Verify playback started for GPU_OUT
    const playingAnim = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(playingAnim?.playbackState).toBe("playing");

    // Verify educational selection remains coherent during motion
    const midSnap = await page.evaluate(() => window.pcAnatomy?.education.getSnapshot());
    expect(midSnap?.selectedComponent, "Selection must remain coherent during animation").toBe("GPU");
    expect(midSnap?.content?.displayName).toContain("Graphics Processing Unit");

    // 3. Wait for animation to finish
    await page.waitForFunction(() => {
      const snap = window.pcAnatomy?.animation.getSnapshot();
      return snap?.playbackState === "idle";
    }, undefined, { timeout: 30000 });

    // Educational context remains intact after animation completes
    const postSnap = await page.evaluate(() => window.pcAnatomy?.education.getSnapshot());
    expect(postSnap?.selectedComponent).toBe("GPU");
    expect(postSnap?.content?.id).toBe("GPU");

    expect(errors).toEqual([]);
  });

  test("disassemble action plays correct stage for MOTHERBOARD", async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    await page.evaluate(() => {
      window.pcAnatomy?.interaction.select("MOTHERBOARD");
      window.pcAnatomy?.education.disassemble("MOTHERBOARD");
    });
    await page.waitForTimeout(200);

    const anim = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(anim?.playbackState).toBe("playing");

    const eduSnap = await page.evaluate(() => window.pcAnatomy?.education.getSnapshot());
    expect(eduSnap?.selectedComponent).toBe("MOTHERBOARD");

    await page.waitForFunction(() => {
      const snap = window.pcAnatomy?.animation.getSnapshot();
      return snap?.playbackState === "idle";
    }, undefined, { timeout: 30000 });

    const finalAnim = await page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
    expect(finalAnim?.currentStage).toBe("MOTHERBOARD_OUT");

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §3. REGISTRY COMPLETENESS & FIELD INTEGRITY
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §3 — Registry Completeness & Field Integrity", () => {
  test("all 19 semantic components have complete, non-empty educational entries", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const result = await page.evaluate((componentIds) => {
      const api = window.pcAnatomy;
      if (!api) return { error: "No pcAnatomy API" };

      const entries: Record<string, any> = {};
      for (const id of componentIds) {
        try {
          const content = api.education.getContent(id as any);
          entries[id] = {
            id: content.id,
            displayName: content.displayName,
            category: content.category,
            shortDescription: content.shortDescription,
            purpose: content.purpose,
            connectionsCount: content.connections.length,
            keyLearningPointsCount: content.keyLearningPoints.length,
            hasDisassembly: Boolean(content.disassembly),
            actionType: content.disassembly.actionType,
            contentStatus: content.contentStatus,
            sourceRefsCount: content.sourceRefs.length,
          };
        } catch (e: any) {
          entries[id] = { error: e.message };
        }
      }
      return entries;
    }, SEMANTIC_COMPONENT_IDS);

    expect(Object.keys(result)).toHaveLength(19);

    for (const id of SEMANTIC_COMPONENT_IDS) {
      const entry = result[id];
      expect(entry.error, `${id}: Must not throw error`).toBeUndefined();
      expect(entry.id, `${id}: ID match`).toBe(id);
      expect(entry.displayName.length, `${id}: displayName must be non-empty`).toBeGreaterThan(2);
      expect(entry.shortDescription.length, `${id}: shortDescription must be non-empty`).toBeGreaterThan(10);
      expect(entry.purpose.length, `${id}: purpose must be non-empty`).toBeGreaterThan(10);
      expect(entry.keyLearningPointsCount, `${id}: must have at least 1 key learning point`).toBeGreaterThan(0);
      expect(entry.hasDisassembly, `${id}: must have disassembly metadata`).toBe(true);
      expect(entry.sourceRefsCount, `${id}: must have source references`).toBeGreaterThan(0);
    }

    expect(errors).toEqual([]);
  });

  test("RAM 01-04 share base template with unique instance slot labels", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const ramData = await page.evaluate(() => {
      const ramIds = ["RAM_01", "RAM_02", "RAM_03", "RAM_04"] as const;
      return ramIds.map((id) => window.pcAnatomy?.education.getContent(id));
    });

    for (let i = 0; i < 4; i++) {
      const ram = ramData[i];
      expect(ram?.instanceMetadata?.index).toBe(i + 1);
      expect(ram?.instanceMetadata?.total).toBe(4);
      expect(ram?.instanceMetadata?.slotLabel).toBe(`DIMM_${i + 1}`);
      expect(ram?.category).toBe("memory");
      expect(ram?.disassembly.disassemblyStage).toBe("RAM_OUT");
    }

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §4. PROVENANCE & SOURCE REFERENCES
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §4 — Educational Provenance & Source References", () => {
  test("all components declare valid contentStatus and non-empty sourceRefs", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const provenanceList = await page.evaluate((componentIds) => {
      return componentIds.map((id) => {
        const content = window.pcAnatomy?.education.getContent(id as any);
        return {
          id,
          status: content?.contentStatus,
          sourceRefs: content?.sourceRefs ?? [],
        };
      });
    }, SEMANTIC_COMPONENT_IDS);

    for (const item of provenanceList) {
      expect(["verified", "review_required", "placeholder"]).toContain(item.status);
      expect(item.sourceRefs.length, `${item.id}: sourceRefs must not be empty`).toBeGreaterThan(0);
    }

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §5. DIRECTIONAL RELATIONSHIPS & CONNECTIVITY
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §5 — Directional Relationships & Graph Consistency", () => {
  test("all connection targets resolve to valid semantic IDs and maintain directional semantics", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const validation = await page.evaluate((validIds) => {
      // @ts-ignore
      const runtime = window.__PC_ANATOMY_RUNTIME__?.();
      const registry = runtime?.educationController?.registry;
      if (!registry) return { valid: false, error: "No registry" };

      const allEntries = registry.getAllEntries();
      const invalidTargets: string[] = [];

      for (const entry of allEntries) {
        for (const conn of entry.connections) {
          if (!validIds.includes(conn.target)) {
            invalidTargets.push(`${entry.id} -> ${conn.target}`);
          }
        }
      }

      const gpuEntry = registry.get("GPU");
      const gpuPowerConn = gpuEntry.connections.find((c: any) => c.target === "CABLE_GPU_POWER");

      const cableGpuEntry = registry.get("CABLE_GPU_POWER");
      const cablePowersGpu = cableGpuEntry.connections.find((c: any) => c.target === "GPU");

      return {
        invalidTargets,
        gpuReceivesPower: gpuPowerConn?.type === "receives_power",
        cablePowersGpu: cablePowersGpu?.type === "powers",
      };
    }, SEMANTIC_COMPONENT_IDS);

    expect(validation.invalidTargets).toEqual([]);
    expect(validation.gpuReceivesPower, "GPU must declare receives_power from cable").toBe(true);
    expect(validation.cablePowersGpu, "CABLE_GPU_POWER must declare powers GPU").toBe(true);

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §6. STAGE MAPPING VALIDITY & CABLE STAGE SEPARATION
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §6 — Stage Mapping & Cable Stage Separation", () => {
  test("disconnectStage and disassemblyStage are valid known stage IDs", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const stageCheck = await page.evaluate((componentIds) => {
      return componentIds.map((id) => {
        const content = window.pcAnatomy?.education.getContent(id as any);
        return {
          id,
          disassemblyStage: content?.disassembly.disassemblyStage,
          disconnectStage: content?.disassembly.disconnectStage,
        };
      });
    }, SEMANTIC_COMPONENT_IDS);

    for (const item of stageCheck) {
      if (item.disassemblyStage) {
        expect(KNOWN_STAGE_IDS, `${item.id}: disassemblyStage must exist in animation_stages.json`).toContain(item.disassemblyStage);
      }
      if (item.disconnectStage) {
        expect(KNOWN_STAGE_IDS, `${item.id}: disconnectStage must exist in animation_stages.json`).toContain(item.disconnectStage);
      }
    }

    // Explicit check for the 3 power cables
    for (const cableId of ["CABLE_24PIN", "CABLE_CPU_POWER", "CABLE_GPU_POWER"] as const) {
      const cable = stageCheck.find((c) => c.id === cableId);
      expect(cable?.disconnectStage, `${cableId}: disconnectStage must be MOTHERBOARD_OUT`).toBe("MOTHERBOARD_OUT");
      expect(cable?.disassemblyStage, `${cableId}: disassemblyStage must be SECONDARY_OUT`).toBe("SECONDARY_OUT");
    }

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §7. CONCEPTUAL M.2 COPY
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §7 — Conceptual M.2 Educational Copy", () => {
  test("M.2 copy describes angular disengagement conceptually without exposing internal constants", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    const m2Content = await page.evaluate(() => window.pcAnatomy?.education.getContent("M2_SSD"));
    expect(m2Content).toBeTruthy();

    const fullText = `${m2Content?.shortDescription} ${m2Content?.purpose} ${m2Content?.keyLearningPoints.join(" ")}`;
    expect(fullText.toLowerCase()).toContain("pivot");
    expect(fullText).not.toContain("12°"); // Does not expose raw keyframe degree constant in user copy

    expect(errors).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────
// §8. PANEL DOM & CHIP NAVIGATION
// ──────────────────────────────────────────────────────────────────
test.describe("W4 §8 — Educational Panel DOM & Chip Navigation", () => {
  test("selecting GPU displays panel with title and clicking Motherboard chip selects Motherboard", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = await openRuntime(page);

    // Select GPU
    await page.evaluate(() => window.pcAnatomy?.interaction.select("GPU"));
    await page.waitForTimeout(100);

    const panel = page.locator("#education-panel");
    await expect(panel).toBeVisible();

    // Check title
    const title = page.locator("#edu-panel-title");
    await expect(title).toContainText("Graphics Processing Unit");

    // Find Motherboard chip and click it
    const mbChip = page.locator('button.edu-chip[data-component-target="MOTHERBOARD"]');
    await expect(mbChip).toBeVisible();
    await mbChip.click();
    await page.waitForTimeout(100);

    // Verify selection transitioned to MOTHERBOARD
    const selectedId = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot()?.selected);
    expect(selectedId).toBe("MOTHERBOARD");

    // Title updates to Motherboard
    await expect(title).toContainText("Motherboard");

    // Click deselect button
    const closeBtn = page.locator('button.edu-close-btn[data-action="clear"]');
    await closeBtn.click();
    await page.waitForTimeout(100);

    // Panel should be hidden
    await expect(panel).toBeHidden();
    const clearSnap = await page.evaluate(() => window.pcAnatomy?.interaction.getSnapshot());
    expect(clearSnap?.selected).toBeNull();

    expect(errors).toEqual([]);
  });
});
