import type { WebGLRenderer } from "three";
import type { CameraController } from "../camera/camera-controller";
import type { AssetInventory, PerformanceBaseline } from "../core/types";
import type { TimelineController } from "../animation/timeline-controller";

interface DebugPanelOptions {
  inventory: AssetInventory;
  performance: PerformanceBaseline;
  camera: CameraController;
  timeline: TimelineController;
  renderer: WebGLRenderer;
}

const ROWS: [string, string][] = [
  ["FPS", "steadyFps"],
  ["Load", "initialLoadMs"],
  ["Resolution", "renderWidth"],
  ["DPR", "dpr"],
  ["Draw calls", "drawCalls"],
  ["Triangles", "triangles"],
  ["Raw glTF nodes", "rawGltfNodes"],
  ["Named logical", "namedLogicalNodes"],
  ["Semantic components", "semanticComponents"],
  ["Meshes", "meshes"],
  ["Materials", "materials"],
  ["Animations", "animations"],
  ["Camera", "camera"],
  ["Stage", "stage"],
  ["Playback", "playback"],
  ["Timeline", "timeline"],
];

export class DebugPanel {
  readonly #root: HTMLElement;
  readonly #values = new Map<string, HTMLElement>();
  readonly #options: DebugPanelOptions;

  constructor(options: DebugPanelOptions) {
    this.#options = options;
    this.#root = document.createElement("aside");
    this.#root.className = "debug-panel";
    this.#root.setAttribute("aria-label", "Runtime diagnostics");

    const title = document.createElement("h2");
    title.textContent = "W1 Runtime Diagnostics";
    this.#root.appendChild(title);

    const grid = document.createElement("dl");
    grid.className = "debug-grid";
    for (const [label, key] of ROWS) {
      const term = document.createElement("dt");
      term.textContent = label;
      const value = document.createElement("dd");
      value.dataset.metric = key;
      value.textContent = "—";
      grid.append(term, value);
      this.#values.set(key, value);
    }
    this.#root.appendChild(grid);

    const cameraActions = document.createElement("div");
    cameraActions.className = "debug-actions";
    cameraActions.append(
      this.#button("Hero", () => options.camera.hero()),
      this.#button("Open", () => options.camera.open()),
      this.#button("Reset Cam", () => options.camera.reset()),
    );
    this.#root.appendChild(cameraActions);

    const animActions = document.createElement("div");
    animActions.className = "debug-actions";
    animActions.append(
      this.#button("Play All", () => options.timeline.playAll()),
      this.#button("Pause/Res", () => {
        const snap = options.timeline.getSnapshot();
        if (snap.playbackState === "playing") options.timeline.pause();
        else options.timeline.resume();
      }),
      this.#button("Reset Anim", () => options.timeline.reset()),
    );
    this.#root.appendChild(animActions);
    document.getElementById("experience")?.appendChild(this.#root);
    this.update();
  }

  update(): void {
    const { inventory, performance, camera, renderer } = this.#options;
    performance.renderWidth = renderer.domElement.width;
    performance.renderHeight = renderer.domElement.height;
    performance.dpr = renderer.getPixelRatio();
    performance.drawCalls = renderer.info.render.calls;
    performance.triangles = renderer.info.render.triangles;

    const resolution = this.#values.get("renderWidth");
    if (resolution) resolution.textContent = `${performance.renderWidth}×${performance.renderHeight}`;
    const load = this.#values.get("initialLoadMs");
    if (load) load.textContent = `${performance.initialLoadMs.toFixed(0)} ms`;
    const fps = this.#values.get("steadyFps");
    if (fps) fps.textContent = performance.steadyFps > 0 ? performance.steadyFps.toFixed(1) : "measuring";
    const cameraValue = this.#values.get("camera");
    if (cameraValue) cameraValue.textContent = camera.state;

    const snap = this.#options.timeline.getSnapshot();
    const stageVal = this.#values.get("stage");
    if (stageVal) stageVal.textContent = snap.currentStage || "—";
    const playVal = this.#values.get("playback");
    if (playVal) playVal.textContent = snap.playbackState;
    const timeVal = this.#values.get("timeline");
    if (timeVal) timeVal.textContent = snap.timelineTime.toFixed(3) + "s";

    for (const key of ["dpr", "drawCalls", "triangles"] as const) {
      const element = this.#values.get(key);
      if (element) element.textContent = String(performance[key]);
    }
    for (const key of Object.keys(inventory) as (keyof AssetInventory)[]) {
      const element = this.#values.get(key);
      if (element) element.textContent = String(inventory[key]);
    }
  }

  dispose(): void {
    this.#root.remove();
    this.#values.clear();
  }

  #button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }
}
