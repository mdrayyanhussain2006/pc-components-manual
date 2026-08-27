import { expect, test, type Page } from "@playwright/test";

const SCREENSHOTS = "artifacts/screenshots";

async function openRuntime(page: Page, path = "/"): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(path);
  await page.waitForFunction(() => window.pcAnatomy?.getState().status === "ready");
  await page.waitForTimeout(1000);
  return errors;
}

async function animationSnapshot(page: Page) {
  return page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
}

test.describe("W2 Animation Orchestration", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("playStage plays segment and parks", async ({ page }) => {
    const errors = await openRuntime(page);
    
    await page.evaluate(() => window.pcAnatomy?.animation.playStage("OPEN_CASE"));
    
    // Wait until playback state is idle again
    await page.waitForFunction(() => {
      const snap = window.pcAnatomy?.animation.getSnapshot();
      return snap?.playbackState === "idle" && snap?.currentStage === "OPEN_CASE";
    }, { timeout: 10000 });

    const snap = await animationSnapshot(page);
    expect(snap?.playbackState).toBe("idle");
    expect(snap?.currentStage).toBe("OPEN_CASE");
    expect(snap?.targetStage).toBeNull();
    
    await page.screenshot({ path: `${SCREENSHOTS}/w2-play-stage-parked.png` });
    expect(errors).toEqual([]);
  });

  test("playAll reaches FINAL_EXPLODE and reset restores ASSEMBLED", async ({ page }) => {
    test.setTimeout(90000);
    const errors = await openRuntime(page);
    
    await page.evaluate(() => window.pcAnatomy?.animation.playAll());
    
    // playAll takes ~40s, so we set a long timeout
    await page.waitForFunction(() => {
      const snap = window.pcAnatomy?.animation.getSnapshot();
      return snap?.playbackState === "idle" && snap?.currentStage === "FINAL_EXPLODE";
    }, { timeout: 45000 });

    const explodeSnap = await animationSnapshot(page);
    expect(explodeSnap?.playbackState).toBe("idle");
    expect(explodeSnap?.currentStage).toBe("FINAL_EXPLODE");
    
    await page.screenshot({ path: `${SCREENSHOTS}/w2-playall-exploded.png` });

    // Test Reset
    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500); // Give it a moment to apply

    const resetSnap = await animationSnapshot(page);
    expect(resetSnap?.playbackState).toBe("idle");
    expect(resetSnap?.currentStage).toBe("ASSEMBLED");
    // Verify time is near 0.0416
    expect(resetSnap?.timelineTime).toBeCloseTo(0.0416, 2);

    await page.screenshot({ path: `${SCREENSHOTS}/w2-reset-assembled.png` });
    expect(errors).toEqual([]);
  });

  test("deterministic shared-timeline pose", async ({ page }) => {
    const errors = await openRuntime(page, "/?debug=1"); // Need debug mode to access __PC_ANATOMY_RUNTIME__
    
    // Function to seek and return a snapshot of key node positions
    const getPoseSnapshot = async (time: number) => {
      return page.evaluate((t) => {
        window.pcAnatomy?.animation.seekTo(t);
        // @ts-ignore
        const runtime = window.__PC_ANATOMY_RUNTIME__?.();
        const positions = runtime?.getDebugNodePositions();
        
        return {
          time: window.pcAnatomy?.animation.getSnapshot()?.timelineTime,
          mbPosition: positions?.["MOTHERBOARD"] || null,
          cpuCoolerPosition: positions?.["CPU_COOLER"] || null,
          cablePosition: positions?.["CABLE_24PIN"] || null,
        };
      }, time);
    };

    const snap1 = await getPoseSnapshot(3.0);
    const snap2 = await getPoseSnapshot(15.0);
    const snap3 = await getPoseSnapshot(3.0);

    expect(snap1?.time).toBeCloseTo(3.0, 2);
    expect(snap2?.time).toBeCloseTo(15.0, 2);
    expect(snap3?.time).toBeCloseTo(3.0, 2);
    
    // Position at t=3.0 should be exactly the same after seeking to 15.0 and back to 3.0
    expect(snap1.mbPosition).toEqual(snap3.mbPosition);
    expect(snap1.cpuCoolerPosition).toEqual(snap3.cpuCoolerPosition);
    expect(snap1.cablePosition).toEqual(snap3.cablePosition);
    
    // Position at t=15.0 should be different for motherboard
    expect(snap1.mbPosition).not.toEqual(snap2.mbPosition);

    expect(errors).toEqual([]);
  });
});
