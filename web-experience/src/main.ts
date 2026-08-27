import "./styles/main.css";
import { ExperienceRuntime } from "./runtime/core/experience-runtime";
import { RuntimeStateStore } from "./runtime/core/state-store";
import type {
  ComponentReadyResult,
  PcAnatomyPublicApi,
  RuntimeReadinessState,
} from "./runtime/core/types";
import { ProductHeader } from "./ui/shell/product-header";
import { StageNav } from "./ui/shell/stage-nav";
import { PlaybackBar } from "./ui/controls/playback-bar";
import type { StageId } from "./runtime/animation/types";

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required W1 runtime element is missing: ${selector}`);
  return element;
}

const canvas = getRequiredElement<HTMLCanvasElement>("#experience-canvas");
const statusLayer = getRequiredElement<HTMLElement>("#runtime-status");
const statusCard = getRequiredElement<HTMLElement>("#runtime-status .status-card");
const statusMessage = getRequiredElement<HTMLElement>("#status-message");
const retryButton = getRequiredElement<HTMLButtonElement>("#retry-button");

const headerSlot = getRequiredElement<HTMLElement>("#ui-header-slot");
const controlsSlot = getRequiredElement<HTMLElement>("#ui-controls-slot");

const debugEnabled = new URLSearchParams(window.location.search).get("debug") === "1";
const stateStore = new RuntimeStateStore({
  status: "loading",
  attempt: 0,
  message: "Loading the technical visualization…",
});

let runtime: ExperienceRuntime | null = null;
let productHeader: ProductHeader | null = null;
let stageNav: StageNav | null = null;
let playbackBar: PlaybackBar | null = null;
let attempt = 0;
let disposed = false;
let uiSyncRaf = 0;

function renderState(state: RuntimeReadinessState): void {
  statusCard.dataset.status = state.status;
  if (state.status === "loading") {
    statusLayer.hidden = false;
    retryButton.hidden = true;
    statusMessage.textContent = state.message;
    return;
  }
  if (state.status === "error") {
    statusLayer.hidden = false;
    statusLayer.setAttribute("role", "alert");
    retryButton.hidden = false;
    statusMessage.textContent = state.message;
    return;
  }
  statusLayer.hidden = true;
  statusLayer.setAttribute("role", "status");
}

stateStore.subscribe(renderState);

function syncUi(): void {
  if (disposed) return;
  const animSnap = runtime?.timelineController?.getSnapshot() ?? null;
  stageNav?.update(animSnap);
  playbackBar?.update(animSnap);
  uiSyncRaf = requestAnimationFrame(syncUi);
}

async function startRuntime(): Promise<void> {
  if (disposed) return;
  runtime?.dispose();
  runtime = null;
  productHeader?.dispose();
  stageNav?.dispose();
  playbackBar?.dispose();

  attempt += 1;
  stateStore.setState({
    status: "loading",
    attempt,
    message: "Loading the technical visualization…",
  });

  const candidate = new ExperienceRuntime({
    canvas,
    debug: debugEnabled,
    onLoadProgress: (ratio) => {
      const percentage = ratio === null ? null : Math.round(ratio * 100);
      const current = stateStore.getState();
      if (current.status !== "loading") return;
      stateStore.setState({
        ...current,
        message: percentage === null
          ? "Loading the 3D model…"
          : `Loading the 3D model… ${percentage}%`,
      });
    },
    onFatalError: (message, error) => {
      console.error("[PC Anatomy] Runtime failure", error);
      stateStore.setState({
        status: "error",
        attempt,
        message: `${message} Please try again.`,
        technicalMessage: error instanceof Error ? error.stack ?? error.message : String(error),
        retryable: true,
      });
    },
    onContextRestored: () => {
      void startRuntime();
    },
  });
  runtime = candidate;

  try {
    const result = await candidate.initialize();
    if (candidate !== runtime || disposed) {
      candidate.dispose();
      return;
    }

    // Initialize W5 Shell UI components
    productHeader = new ProductHeader(headerSlot);

    stageNav = new StageNav({
      container: controlsSlot,
      onStageClick: (stageId: StageId) => {
        publicApi.animation.playStage(stageId);
      },
    });

    playbackBar = new PlaybackBar({
      container: controlsSlot,
      onPrev: () => publicApi.animation.prev(),
      onNext: () => publicApi.animation.next(),
      onPlayPause: () => {
        const snap = publicApi.animation.getSnapshot();
        if (snap?.playbackState === "playing") {
          publicApi.animation.pause();
        } else if (snap?.playbackState === "paused") {
          publicApi.animation.resume();
        } else {
          publicApi.animation.playAll();
        }
      },
      onReset: () => {
        publicApi.interaction.clear();
        publicApi.animation.reset();
        publicApi.camera.reset();
      },
    });

    // Subscribe to education panel changes to fade product header when component is selected
    candidate.educationController?.subscribe((snap) => {
      productHeader?.setFaded(Boolean(snap.selectedComponent));
    });

    cancelAnimationFrame(uiSyncRaf);
    uiSyncRaf = requestAnimationFrame(syncUi);

    stateStore.setState({
      status: "ready",
      attempt,
      inventory: result.inventory,
      performance: result.performance,
    });
    console.info("[PC Anatomy] W5 runtime ready", {
      inventory: result.inventory,
      performance: result.performance,
      debug: debugEnabled,
    });
  } catch (error) {
    if (candidate !== runtime || disposed) return;
    console.error("[PC Anatomy] Initialization failed", error);
    stateStore.setState({
      status: "error",
      attempt,
      message: "The 3D model could not be prepared. Check your connection and try again.",
      technicalMessage: error instanceof Error ? error.stack ?? error.message : String(error),
      retryable: true,
    });
  }
}

function componentReady(componentId: string): ComponentReadyResult {
  return { implemented: false, phase: "W3", componentId };
}

const publicApi: PcAnatomyPublicApi = {
  getState: () => stateStore.getState(),
  getPerformance: () => runtime?.performance ?? null,
  subscribe: (listener) => stateStore.subscribe(listener),
  retry: startRuntime,
  dispose: dispose,
  camera: {
    hero: (immediate = false) => runtime?.cameraController?.hero(immediate),
    open: (immediate = false) => runtime?.cameraController?.open(immediate),
    reset: (immediate = false) => runtime?.cameraController?.reset(immediate),
    focusOn: (componentId: string, immediate = false) => {
      const bounds = runtime?.interactionController?.getComponentBounds(componentId as any);
      if (bounds) runtime?.cameraController?.focusOn(bounds, componentId, immediate);
    },
    getSnapshot: () => runtime?.cameraController?.getSnapshot() ?? null,
    componentReady,
  },
  interaction: {
    select: (id) => runtime?.interactionController?.select(id),
    clear: () => runtime?.interactionController?.clear(),
    getSnapshot: () => runtime?.interactionController?.getSnapshot() ?? null,
  },
  education: {
    getContent: (id) => runtime?.educationController?.getContent(id) as any,
    getSnapshot: () => runtime?.educationController?.getSnapshot() ?? null as any,
    disassemble: (id) => runtime?.educationController?.disassemble(id),
    subscribe: (listener) => runtime?.educationController?.subscribe(listener) ?? (() => {}),
  },
  animation: {
    playStage: (id) => {
      if (id === "FINAL_EXPLODE" || id === "ASSEMBLED") {
        runtime?.interactionController?.clear();
        runtime?.educationController?.clear();
      }
      runtime?.timelineController?.playStage(id);
    },
    playTo: (id) => {
      if (id === "FINAL_EXPLODE" || id === "ASSEMBLED") {
        runtime?.interactionController?.clear();
        runtime?.educationController?.clear();
      }
      runtime?.timelineController?.playTo(id);
    },
    playAll: () => {
      runtime?.interactionController?.clear();
      runtime?.educationController?.clear();
      runtime?.timelineController?.playAll();
    },
    pause: () => runtime?.timelineController?.pause(),
    resume: () => runtime?.timelineController?.resume(),
    reset: () => {
      runtime?.interactionController?.clear();
      runtime?.educationController?.clear();
      runtime?.timelineController?.reset();
    },
    replayStage: (id) => runtime?.timelineController?.replayStage(id),
    next: () => runtime?.timelineController?.next(),
    prev: () => runtime?.timelineController?.prev(),
    seekTo: (time) => runtime?.timelineController?.seekTo(time),
    interrupt: () => runtime?.timelineController?.interrupt(),
    getSnapshot: () => runtime?.timelineController?.getSnapshot() ?? null,
  },
};
window.pcAnatomy = publicApi;

if (debugEnabled) {
  // @ts-ignore
  window.__PC_ANATOMY_RUNTIME__ = () => runtime;
}

retryButton.addEventListener("click", () => void startRuntime());
window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (event.key.toLowerCase() === "h") publicApi.camera.hero();
  if (event.key.toLowerCase() === "o") publicApi.camera.open();
  if (event.key.toLowerCase() === "r") {
    publicApi.interaction.clear();
    publicApi.animation.reset();
    publicApi.camera.reset();
  }
  if (event.key === "Escape") {
    publicApi.interaction.clear();
    publicApi.animation.reset();
    publicApi.camera.reset();
  }
  if (event.key === " ") {
    event.preventDefault();
    const snap = publicApi.animation.getSnapshot();
    if (snap?.playbackState === "playing") publicApi.animation.pause();
    else publicApi.animation.resume();
  }
  if (event.key === "ArrowRight") {
    publicApi.animation.next();
  }
  if (event.key === "ArrowLeft") {
    publicApi.animation.prev();
  }
});
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) dispose();
});

function dispose(): void {
  if (disposed) return;
  disposed = true;
  cancelAnimationFrame(uiSyncRaf);
  productHeader?.dispose();
  productHeader = null;
  stageNav?.dispose();
  stageNav = null;
  playbackBar?.dispose();
  playbackBar = null;
  runtime?.dispose();
  runtime = null;
  stateStore.clear();
  delete window.pcAnatomy;
}

void startRuntime();
