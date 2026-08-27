import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";

export interface RendererHostOptions {
  canvas: HTMLCanvasElement;
  onContextLost: (event: WebGLContextEvent) => void;
  onContextRestored: () => void;
}

export class RendererHost {
  readonly renderer: WebGLRenderer;
  readonly #canvas: HTMLCanvasElement;
  readonly #onContextLost: (event: Event) => void;
  readonly #onContextRestored: () => void;

  constructor(options: RendererHostOptions) {
    this.#canvas = options.canvas;
    this.renderer = new WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.#onContextLost = (event) => {
      event.preventDefault();
      options.onContextLost(event as WebGLContextEvent);
    };
    this.#onContextRestored = options.onContextRestored;
    this.#canvas.addEventListener("webglcontextlost", this.#onContextLost, false);
    this.#canvas.addEventListener("webglcontextrestored", this.#onContextRestored, false);
  }

  resize(width: number, height: number): void {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(safeWidth, safeHeight, false);
  }

  dispose(): void {
    this.#canvas.removeEventListener("webglcontextlost", this.#onContextLost, false);
    this.#canvas.removeEventListener("webglcontextrestored", this.#onContextRestored, false);
    this.renderer.dispose();
  }
}
