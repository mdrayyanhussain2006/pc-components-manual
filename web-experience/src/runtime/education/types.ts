import type { SemanticComponentId } from "../core/types";
import type { StageId } from "../animation/types";

export type ContentStatus = "verified" | "review_required" | "placeholder";

export type ConnectionType =
  | "mounts_on"
  | "mounted_by"
  | "connects_to"
  | "powers"
  | "receives_power"
  | "encloses"
  | "enclosed_by"
  | "routes_to"
  | "cools"
  | "cooled_by"
  | "communicates_with";

export interface ComponentConnection {
  readonly target: SemanticComponentId;
  readonly type: ConnectionType;
  readonly description: string;
  readonly status: ContentStatus;
  readonly sourceRefs: readonly string[];
}

export type DisassemblyActionType =
  | "extract_with_riders"      // MOTHERBOARD: extracts carrying CPU, cooler, RAM, GPU, SSD
  | "extract_isolated"         // CPU, CPU_COOLER, GPU, M2_SSD, PSU, CASE_FAN_*: discrete part extraction
  | "disconnect_and_extract"   // Power cables: early disconnect in MB_OUT, extracted in SECONDARY_OUT
  | "panel_open"               // CASE_SIDE_PANEL: slides rearward and sets aside
  | "explode_presentation"     // CASE: exploded presentation view, not literal chassis removal
  | "eject_sequential";        // RAM: sequential slot ejection

export interface DisassemblyActionMetadata {
  readonly actionType: DisassemblyActionType;
  readonly disconnectStage?: StageId;
  readonly disassemblyStage?: StageId;
  readonly mechanicalDescription: string;
  readonly sourceRefs: readonly string[];
}

export interface EducationContentModel {
  readonly id: SemanticComponentId;
  readonly displayName: string;
  readonly category: "processing" | "memory" | "storage" | "graphics" | "power" | "cooling" | "chassis" | "interconnect";
  readonly shortDescription: string;
  readonly purpose: string;
  readonly connections: readonly ComponentConnection[];
  readonly keyLearningPoints: readonly string[];
  readonly terminology?: readonly { term: string; definition: string }[];
  readonly notes?: readonly string[];
  readonly relatedComponents: readonly SemanticComponentId[];
  readonly disassembly: DisassemblyActionMetadata;
  readonly contentStatus: ContentStatus;
  readonly sourceRefs: readonly string[];
  readonly instanceMetadata?: {
    readonly index: number;
    readonly total: number;
    readonly slotLabel: string;
  };
}

export interface EducationActionItem {
  readonly id: "disassemble" | "focus" | "clear";
  readonly label: string;
  readonly stageId?: StageId;
  readonly description?: string;
}

export interface EducationPanelSnapshot {
  readonly selectedComponent: SemanticComponentId | null;
  readonly content: EducationContentModel | null;
  readonly relatedComponents: readonly SemanticComponentId[];
  readonly availableActions: readonly EducationActionItem[];
}
