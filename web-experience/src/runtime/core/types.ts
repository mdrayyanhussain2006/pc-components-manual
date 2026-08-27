export const SEMANTIC_COMPONENT_IDS = [
  "CASE",
  "CASE_SIDE_PANEL",
  "MOTHERBOARD",
  "CPU",
  "CPU_COOLER",
  "RAM_01",
  "RAM_02",
  "RAM_03",
  "RAM_04",
  "GPU",
  "M2_SSD",
  "STORAGE",
  "PSU",
  "CASE_FAN_01",
  "CASE_FAN_02",
  "CASE_FAN_03",
  "CABLE_24PIN",
  "CABLE_CPU_POWER",
  "CABLE_GPU_POWER",
] as const;

export type SemanticComponentId = (typeof SEMANTIC_COMPONENT_IDS)[number];
export type CameraStateName = "hero" | "open" | "custom" | "transitioning";

import type { StageId, TimelineSnapshot, PlaybackState } from "../animation/types";
export type { StageId, TimelineSnapshot, PlaybackState };

import type {
  EducationContentModel,
  EducationPanelSnapshot,
} from "../education/types";
export type { EducationContentModel, EducationPanelSnapshot };

export interface AssetInventory {
  rawGltfNodes: number;
  namedLogicalNodes: number;
  semanticComponents: number;
  meshes: number;
  materials: number;
  animations: number;
}

export interface PerformanceBaseline {
  initialLoadMs: number;
  steadyFps: number;
  renderWidth: number;
  renderHeight: number;
  dpr: number;
  drawCalls: number;
  triangles: number;
}

export interface CameraSnapshot {
  state: CameraStateName;
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
}

export type RuntimeReadinessState =
  | {
      status: "loading";
      attempt: number;
      message: string;
    }
  | {
      status: "ready";
      attempt: number;
      inventory: AssetInventory;
      performance: PerformanceBaseline;
    }
  | {
      status: "error";
      attempt: number;
      message: string;
      technicalMessage: string;
      retryable: true;
    };

export type RuntimeStateListener = (state: RuntimeReadinessState) => void;

export interface ComponentReadyResult {
  implemented: false;
  phase: "W3";
  componentId: string;
}

export interface PcAnatomyPublicApi {
  getState(): RuntimeReadinessState;
  getPerformance(): PerformanceBaseline | null;
  subscribe(listener: RuntimeStateListener): () => void;
  retry(): Promise<void>;
  dispose(): void;
  camera: {
    hero(immediate?: boolean): void;
    open(immediate?: boolean): void;
    reset(immediate?: boolean): void;
    focusOn(componentId: string, immediate?: boolean): void;
    getSnapshot(): CameraSnapshot | null;
    componentReady(componentId: string): ComponentReadyResult;
  };
  interaction: {
    select(id: SemanticComponentId | null): void;
    clear(): void;
    getSnapshot(): { hovered: SemanticComponentId | null; selected: SemanticComponentId | null } | null;
  };
  education: {
    getContent(id: SemanticComponentId): EducationContentModel;
    getSnapshot(): EducationPanelSnapshot;
    disassemble(id?: SemanticComponentId): void;
    subscribe(listener: (snapshot: EducationPanelSnapshot) => void): () => void;
  };
  animation: {
    playStage(id: StageId): void;
    playTo(id: StageId): void;
    playAll(): void;
    pause(): void;
    resume(): void;
    reset(): void;
    replayStage(id: StageId): void;
    next(): void;
    prev(): void;
    seekTo(time: number): void;
    interrupt(): void;
    getSnapshot(): TimelineSnapshot | null;
  };
}

declare global {
  interface Window {
    pcAnatomy?: PcAnatomyPublicApi;
  }
}

