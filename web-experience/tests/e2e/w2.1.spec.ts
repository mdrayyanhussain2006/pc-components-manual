import { expect, test, type Page } from "@playwright/test";
import animationStagesData from "../../../build/animation_stages.json" assert { type: "json" };

const FPS = animationStagesData.fps;
const STAGES = animationStagesData.stages;

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

async function getAnimSnap(page: Page) {
  return page.evaluate(() => window.pcAnatomy?.animation.getSnapshot());
}

async function waitForIdle(page: Page, stageId: string, timeoutMs = 45000) {
  await page.waitForFunction((expectedStage) => {
    const snap = window.pcAnatomy?.animation.getSnapshot();
    return snap?.playbackState === "idle" && snap?.currentStage === expectedStage;
  }, stageId, { timeout: timeoutMs });
}

test.describe("W2.1 Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("FINAL_EXPLODE semantics", async ({ page }) => {
    test.setTimeout(90000);
    const errors = await openRuntime(page);
    
    // playStage("FINAL_EXPLODE") targets PARK frame 950
    await page.evaluate(() => window.pcAnatomy?.animation.playStage("FINAL_EXPLODE"));
    await waitForIdle(page, "FINAL_EXPLODE", 10000);
    const snap1 = await getAnimSnap(page);
    expect(snap1?.timelineTime).toBeCloseTo(950 / FPS, 2);

    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500);

    // playTo("FINAL_EXPLODE") targets PARK frame 950
    await page.evaluate(() => window.pcAnatomy?.animation.playTo("FINAL_EXPLODE"));
    await waitForIdle(page, "FINAL_EXPLODE", 45000); // 40s wait
    const snap2 = await getAnimSnap(page);
    expect(snap2?.timelineTime).toBeCloseTo(950 / FPS, 2);

    expect(errors).toEqual([]);
  });

  test("playAll targets END frame 974", async ({ page }) => {
    test.setTimeout(90000);
    const errors = await openRuntime(page);
    await page.evaluate(() => window.pcAnatomy?.animation.playAll());
    await waitForIdle(page, "FINAL_EXPLODE", 45000);
    const snap = await getAnimSnap(page);
    expect(snap?.timelineTime).toBeCloseTo(974 / FPS, 2);
    expect(errors).toEqual([]);
  });

  test("Replay regressions", async ({ page }) => {
    test.setTimeout(180000); // multiple playAlls
    const errors = await openRuntime(page);

    // A. playAll() -> reset() -> playAll()
    await page.evaluate(() => window.pcAnatomy?.animation.playAll());
    await waitForIdle(page, "FINAL_EXPLODE", 45000);
    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.pcAnatomy?.animation.playAll());
    await waitForIdle(page, "FINAL_EXPLODE", 45000);
    const snapA = await getAnimSnap(page);
    expect(snapA?.timelineTime).toBeCloseTo(974 / FPS, 2);

    // B. playStage(OPEN_CASE) -> reset() -> playStage(OPEN_CASE)
    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.pcAnatomy?.animation.playStage("OPEN_CASE"));
    await waitForIdle(page, "OPEN_CASE", 10000);
    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.pcAnatomy?.animation.playStage("OPEN_CASE"));
    await waitForIdle(page, "OPEN_CASE", 10000);
    const snapB = await getAnimSnap(page);
    expect(snapB?.currentStage).toBe("OPEN_CASE");

    // C. playAll() -> reset() -> playStage(MOTHERBOARD_OUT)
    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.pcAnatomy?.animation.playAll());
    await waitForIdle(page, "FINAL_EXPLODE", 45000);
    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.pcAnatomy?.animation.playStage("MOTHERBOARD_OUT"));
    await waitForIdle(page, "MOTHERBOARD_OUT", 10000);
    const snapC = await getAnimSnap(page);
    expect(snapC?.currentStage).toBe("MOTHERBOARD_OUT");

    expect(errors).toEqual([]);
  });

  test("Shared-timeline synchronization", async ({ page }) => {
    const errors = await openRuntime(page, "/?debug=1");

    const getPoses = async (time: number) => {
      return page.evaluate((t) => {
        window.pcAnatomy?.animation.seekTo(t);
        // @ts-ignore
        const runtime = window.__PC_ANATOMY_RUNTIME__?.();
        const positions = runtime?.getDebugNodePositions();
        return {
          MOTHERBOARD: positions?.["MOTHERBOARD"],
          GPU: positions?.["GPU"],
          CABLE_24PIN: positions?.["CABLE_24PIN"],
          CABLE_24PIN_CONN_MB: positions?.["CABLE_24PIN_CONN_MB"],
          CABLE_CPU_POWER_CONN_MB: positions?.["CABLE_CPU_POWER_CONN_MB"],
          CABLE_GPU_POWER_CONN_GPU: positions?.["CABLE_GPU_POWER_CONN_GPU"],
        };
      }, time);
    };

    const t1 = 7.0; // inside MOTHERBOARD_OUT
    const t2 = 1.0; // inside ASSEMBLED

    const poseA = await getPoses(t1);
    const poseB = await getPoses(t2);
    const poseC = await getPoses(t1);

    expect(poseA).toEqual(poseC);
    
    // MB moves out during MOTHERBOARD_OUT, so it should differ from ASSEMBLED
    expect(poseA.MOTHERBOARD).not.toEqual(poseB.MOTHERBOARD);
    expect(poseA.CABLE_24PIN_CONN_MB).not.toEqual(poseB.CABLE_24PIN_CONN_MB);

    expect(errors).toEqual([]);
  });

  test("Stage park regression (seekTo parkTime)", async ({ page }) => {
    const errors = await openRuntime(page);

    for (const stage of STAGES) {
      const parkFrame = stage.id === "FINAL_EXPLODE" ? 950 : (stage.park || stage.end || stage.start);
      const parkTime = parkFrame / FPS;

      await page.evaluate((t) => window.pcAnatomy?.animation.seekTo(t), parkTime);
      await page.waitForTimeout(50); // slight wait for UI sync
      const snap = await getAnimSnap(page);

      expect(snap?.currentStage).toBe(stage.id);
      expect(snap?.timelineTime).toBeCloseTo(parkTime, 2);
    }

    expect(errors).toEqual([]);
  });

  test("Playback controls do not throw and preserve deterministic state", async ({ page }) => {
    const errors = await openRuntime(page);

    await page.evaluate(() => window.pcAnatomy?.animation.playAll());
    await page.waitForTimeout(1000);
    
    // Pause
    await page.evaluate(() => window.pcAnatomy?.animation.pause());
    let snap = await getAnimSnap(page);
    expect(snap?.playbackState).toBe("paused");
    
    // Resume
    await page.evaluate(() => window.pcAnatomy?.animation.resume());
    snap = await getAnimSnap(page);
    expect(snap?.playbackState).toBe("playing");

    // Interrupt
    await page.evaluate(() => window.pcAnatomy?.animation.interrupt());
    snap = await getAnimSnap(page);
    expect(snap?.playbackState).toBe("idle");
    expect(snap?.targetStage).toBeNull();

    // ReplayStage
    await page.evaluate(() => window.pcAnatomy?.animation.replayStage("CPU_OUT"));
    snap = await getAnimSnap(page);
    expect(snap?.playbackState).toBe("playing");
    expect(snap?.targetStage).toBe("CPU_OUT");

    // Next
    await page.evaluate(() => window.pcAnatomy?.animation.next());
    snap = await getAnimSnap(page);
    expect(snap?.targetStage).toBe("RAM_OUT"); // next after CPU_OUT

    // Prev
    await page.evaluate(() => window.pcAnatomy?.animation.prev());
    snap = await getAnimSnap(page);
    expect(snap?.targetStage).toBe("CPU_OUT"); // prev after RAM_OUT

    expect(errors).toEqual([]);
  });

  test("currentStage and targetStage are decoupled", async ({ page }) => {
    test.setTimeout(60000);
    const errors = await openRuntime(page);

    // 1. Immediately after playAll():
    //    - currentStage reflects current timeline position (ASSEMBLED)
    //    - targetStage = FINAL_EXPLODE
    await page.evaluate(() => window.pcAnatomy?.animation.playAll());
    await page.waitForTimeout(100); // Give a tiny moment for playback to start
    let snap = await getAnimSnap(page);
    expect(snap?.playbackState).toBe("playing");
    expect(snap?.currentStage).toBe("ASSEMBLED"); // still near timeline start
    expect(snap?.targetStage).toBe("FINAL_EXPLODE");

    // 3. At the final park:
    //    - targetStage clears when finished, currentStage remains at final position
    await waitForIdle(page, "FINAL_EXPLODE", 45000);
    snap = await getAnimSnap(page);
    expect(snap?.playbackState).toBe("idle");
    expect(snap?.currentStage).toBe("FINAL_EXPLODE");
    expect(snap?.targetStage).toBeNull();

    // 2. Immediately after playStage("MOTHERBOARD_OUT"):
    //    - currentStage reflects current timeline position (starts at MOTHERBOARD_OUT)
    //    - targetStage = MOTHERBOARD_OUT
    await page.evaluate(() => window.pcAnatomy?.animation.reset());
    await page.waitForTimeout(500);
    await page.evaluate(() => window.pcAnatomy?.animation.playStage("MOTHERBOARD_OUT"));
    await page.waitForTimeout(100);
    snap = await getAnimSnap(page);
    expect(snap?.playbackState).toBe("playing");
    expect(snap?.currentStage).toBe("MOTHERBOARD_OUT");
    expect(snap?.targetStage).toBe("MOTHERBOARD_OUT");

    await waitForIdle(page, "MOTHERBOARD_OUT", 15000);
    
    expect(errors).toEqual([]);
  });
});
