import {
  Box3,
  Clock,
  Mesh,
  PerspectiveCamera,
  Vector3,
  type Object3D,
  type Scene,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { loadPcAnatomyAsset } from "../asset/load-gltf";
import { validateAssetInventory } from "../asset/inventory";
import { CameraController } from "../camera/camera-controller";
import { DebugPanel } from "../debug/debug-panel";
import { LightingRig } from "../rendering/lighting-rig";
import { TimelineController } from "../animation/timeline-controller";
import { RendererHost } from "../rendering/renderer-host";
import { createExperienceScene, disposeObjectTree } from "../rendering/scene-utils";
import { InteractionController } from "../interaction/interaction-controller";
import { A11yController } from "../interaction/a11y-controller";
import { EducationController } from "../education/education-controller";
import type { AssetInventory, PerformanceBaseline, SemanticComponentId } from "./types";

export interface ExperienceRuntimeOptions {
  canvas: HTMLCanvasElement;
  debug: boolean;
  onLoadProgress: (ratio: number | null) => void;
  onFatalError: (message: string, error: unknown) => void;
  onContextRestored: () => void;
}

export interface RuntimeInitializationResult {
  inventory: AssetInventory;
  performance: PerformanceBaseline;
}

export class ExperienceRuntime {
  readonly #options: ExperienceRuntimeOptions;
  readonly #clock = new Clock();
  #rendererHost: RendererHost | null = null;
  #scene: Scene | null = null;
  #camera: PerspectiveCamera | null = null;
  #controls: OrbitControls | null = null;
  #cameraController: CameraController | null = null;
  #timelineController: TimelineController | null = null;
  #interactionController: InteractionController | null = null;
  #a11yController: A11yController | null = null;
  #educationController: EducationController | null = null;
  #lighting: LightingRig | null = null;
  #model: Object3D | null = null;
  #debugPanel: DebugPanel | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #animationFrame = 0;
  #running = false;
  #disposed = false;
  #fpsFrames = 0;
  #fpsElapsed = 0;
  #debugElapsed = 0;
  #performance: PerformanceBaseline | null = null;

  constructor(options: ExperienceRuntimeOptions) {
    this.#options = options;
  }

  get cameraController(): CameraController | null {
    return this.#cameraController;
  }

  get timelineController(): TimelineController | null {
    return this.#timelineController;
  }

  get interactionController(): InteractionController | null {
    return this.#interactionController;
  }

  get educationController(): EducationController | null {
    return this.#educationController;
  }

  get performance(): PerformanceBaseline | null {
    return this.#performance;
  }

  getDebugNodePositions(): Record<string, [number, number, number]> {
    const positions: Record<string, [number, number, number]> = {};
    if (!this.#model) return positions;
    this.#model.traverse((node) => {
      if (node.name) {
        positions[node.name] = [
          Number(node.position.x.toFixed(4)),
          Number(node.position.y.toFixed(4)),
          Number(node.position.z.toFixed(4)),
        ];
      }
    });
    return positions;
  }

  get camera(): PerspectiveCamera | null {
    return this.#camera;
  }

  /** Debug helper: project a semantic component center to screen-space pixel coords. */
  getComponentScreenCenter(componentId: string): { x: number; y: number } | null {
    if (!this.#interactionController || !this.#camera || !this.#rendererHost) return null;
    const bounds = this.#interactionController.getComponentBounds(componentId as any);
    if (!bounds) return null;
    const center = bounds.getCenter(new Vector3());
    center.project(this.#camera);
    // Convert NDC [-1,+1] to pixel coords
    const canvas = this.#rendererHost.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((center.x + 1) / 2) * rect.width + rect.left,
      y: ((-center.y + 1) / 2) * rect.height + rect.top,
    };
  }

  /** Debug helper: find a screen-space pixel coord that raycasts directly onto this component. */
  getComponentRaycastPoint(componentId: string): { x: number; y: number } | null {
    if (!this.#interactionController) return null;
    return this.#interactionController.getComponentRaycastPoint(componentId as any);
  }

  async initialize(): Promise<RuntimeInitializationResult> {
    const loadStart = performance.now();
    this.#scene = createExperienceScene();
    this.#camera = new PerspectiveCamera(42, 1, 0.001, 100);
    this.#rendererHost = new RendererHost({
      canvas: this.#options.canvas,
      onContextLost: () => {
        this.stop();
        this.#options.onFatalError(
          "The 3D graphics context was interrupted.",
          new Error("WebGL context lost"),
        );
      },
      onContextRestored: this.#options.onContextRestored,
    });

    this.#controls = new OrbitControls(this.#camera, this.#options.canvas);
    this.#resize();

    const gltf = await loadPcAnatomyAsset((progress) => {
      this.#options.onLoadProgress(progress.ratio);
    });
    if (this.#disposed) throw new Error("Runtime was disposed while loading the asset");

    const inventory = validateAssetInventory(gltf);
    this.#model = gltf.scene;
    this.#model.name = this.#model.name || "PC_ANATOMY_MODEL";
    this.#model.traverse((object) => {
      if (object instanceof Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        const hasTransmission = materials.some((material) =>
          "transmission" in material && Number(material.transmission) > 0,
        );
        object.castShadow = !hasTransmission;
        object.receiveShadow = true;
      }
    });
    this.#scene.add(this.#model);

    const bounds = new Box3().setFromObject(this.#model);
    if (bounds.isEmpty()) throw new Error("Loaded GLB has empty render bounds");

    this.#timelineController = new TimelineController(gltf);

    this.#interactionController = new InteractionController(this.#options.canvas, this.#camera, this.#model);
    
    const eduContainer = (document.querySelector("#ui-education-slot") as HTMLElement) ?? this.#options.canvas.parentElement ?? document.body;
    this.#educationController = new EducationController({
      container: eduContainer,
      interactionController: this.#interactionController,
      timelineController: this.#timelineController,
    });

    this.#a11yController = new A11yController({
      container: this.#options.canvas.parentElement ?? document.body,
      onHover: (id) => this.#interactionController?.hover(id),
      onSelect: (id) => {
        this.#interactionController?.select(id);
        this.#educationController?.select(id);
        const bounds = this.#interactionController?.getComponentBounds(id);
        if (bounds) {
          this.#cameraController?.focusOn(bounds, id);
        }
      },
    });

    this.#interactionController.onSelect = (id) => {
      this.#a11yController?.syncFocus(id);
      this.#educationController?.select(id);
      if (id) {
        const bounds = this.#interactionController?.getComponentBounds(id);
        if (bounds) {
          this.#cameraController?.focusOn(bounds, id);
        }
      }
    };

    this.#lighting = new LightingRig(this.#rendererHost.renderer, this.#scene, bounds);
    const { width, height } = this.#viewportSize();
    this.#cameraController = new CameraController({
      camera: this.#camera,
      controls: this.#controls,
      bounds,
      width,
      height,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      onStateChange: () => this.#debugPanel?.update(),
    });

    this.#performance = {
      initialLoadMs: performance.now() - loadStart,
      steadyFps: 0,
      renderWidth: this.#rendererHost.renderer.domElement.width,
      renderHeight: this.#rendererHost.renderer.domElement.height,
      dpr: this.#rendererHost.renderer.getPixelRatio(),
      drawCalls: 0,
      triangles: 0,
    };

    if (this.#options.debug) {
      this.#debugPanel = new DebugPanel({
        inventory,
        performance: this.#performance,
        camera: this.#cameraController!,
        timeline: this.#timelineController!,
        renderer: this.#rendererHost.renderer,
      });
    }

    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(this.#options.canvas.parentElement ?? document.body);
    document.addEventListener("visibilitychange", this.#onVisibilityChange);
    this.start();
    this.#renderFrame(0);

    return { inventory, performance: this.#performance };
  }

  start(): void {
    if (this.#running || this.#disposed) return;
    this.#running = true;
    this.#clock.start();
    this.#animationFrame = requestAnimationFrame(this.#tick);
  }

  stop(): void {
    if (!this.#running) return;
    this.#running = false;
    cancelAnimationFrame(this.#animationFrame);
    this.#clock.stop();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    document.removeEventListener("visibilitychange", this.#onVisibilityChange);
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#debugPanel?.dispose();
    this.#debugPanel = null;
    this.#controls?.dispose();
    this.#controls = null;
    this.#cameraController = null;
    this.#educationController?.dispose();
    this.#educationController = null;
    this.#interactionController?.dispose();
    this.#interactionController = null;
    this.#a11yController?.dispose();
    this.#a11yController = null;
    this.#timelineController?.dispose();
    this.#timelineController = null;
    this.#lighting?.dispose();
    this.#lighting = null;
    if (this.#model) {
      this.#scene?.remove(this.#model);
      disposeObjectTree(this.#model);
    }
    this.#model = null;
    this.#rendererHost?.dispose();
    this.#rendererHost = null;
    this.#scene = null;
    this.#camera = null;
  }

  readonly #tick = (): void => {
    if (!this.#running || this.#disposed) return;
    const delta = Math.min(this.#clock.getDelta(), 0.1);
    this.#renderFrame(delta);
    this.#animationFrame = requestAnimationFrame(this.#tick);
  };

  #renderFrame(delta: number): void {
    if (!this.#rendererHost || !this.#scene || !this.#camera || !this.#controls) return;
    this.#timelineController?.update(delta);
    this.#cameraController?.update(delta);
    this.#controls.update();
    this.#rendererHost.renderer.render(this.#scene, this.#camera);

    if (this.#performance) {
      this.#fpsFrames += 1;
      this.#fpsElapsed += delta;
      this.#debugElapsed += delta;
      if (this.#fpsElapsed >= 1) {
        this.#performance.steadyFps = this.#fpsFrames / this.#fpsElapsed;
        this.#fpsFrames = 0;
        this.#fpsElapsed = 0;
      }
      this.#performance.renderWidth = this.#rendererHost.renderer.domElement.width;
      this.#performance.renderHeight = this.#rendererHost.renderer.domElement.height;
      this.#performance.dpr = this.#rendererHost.renderer.getPixelRatio();
      this.#performance.drawCalls = this.#rendererHost.renderer.info.render.calls;
      this.#performance.triangles = this.#rendererHost.renderer.info.render.triangles;
      if (this.#debugElapsed >= 0.5) {
        this.#debugPanel?.update();
        this.#debugElapsed = 0;
      }
    }
  }

  #resize(): void {
    if (!this.#rendererHost || !this.#camera) return;
    const { width, height } = this.#viewportSize();
    this.#rendererHost.resize(width, height);
    this.#camera.aspect = width / Math.max(1, height);
    this.#camera.updateProjectionMatrix();
    this.#cameraController?.resize(width, height);
  }

  #viewportSize(): { width: number; height: number } {
    const parent = this.#options.canvas.parentElement;
    const rect = parent?.getBoundingClientRect();
    return {
      width: Math.max(1, rect?.width ?? window.innerWidth),
      height: Math.max(1, rect?.height ?? window.innerHeight),
    };
  }

  readonly #onVisibilityChange = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };
}
