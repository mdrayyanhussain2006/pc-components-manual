import type { StageId } from "../../runtime/animation/types";
import type { SemanticComponentId } from "../../runtime/core/types";

/** Human-readable stage names for the product UI. */
export const STAGE_DISPLAY_NAMES: Record<string, string> = {
  ASSEMBLED: "Assembled",
  OPEN_CASE: "Open Case",
  MOTHERBOARD_OUT: "Remove Motherboard",
  CPU_COOLER_OUT: "Remove CPU Cooler",
  CPU_OUT: "Remove CPU",
  RAM_OUT: "Remove Memory",
  GPU_OUT: "Remove Graphics Card",
  STORAGE_OUT: "Remove Storage",
  PSU_OUT: "Remove Power Supply",
  SECONDARY_OUT: "Remove Cables",
  FINAL_EXPLODE: "Full Exploded View",
};

/** Human-readable component names for chip labels, tooltips, etc. */
export const COMPONENT_DISPLAY_NAMES: Record<SemanticComponentId, string> = {
  CASE: "Case",
  CASE_SIDE_PANEL: "Side Panel",
  MOTHERBOARD: "Motherboard",
  CPU: "CPU",
  CPU_COOLER: "CPU Cooler",
  RAM_01: "RAM Slot 1",
  RAM_02: "RAM Slot 2",
  RAM_03: "RAM Slot 3",
  RAM_04: "RAM Slot 4",
  GPU: "Graphics Card",
  M2_SSD: "M.2 SSD",
  STORAGE: "Storage Drive",
  PSU: "Power Supply",
  CASE_FAN_01: "Case Fan 1",
  CASE_FAN_02: "Case Fan 2",
  CASE_FAN_03: "Case Fan 3",
  CABLE_24PIN: "24-Pin Power Cable",
  CABLE_CPU_POWER: "CPU Power Cable",
  CABLE_GPU_POWER: "GPU Power Cable",
};

/** Ordered list of stage IDs in disassembly sequence. */
export const STAGE_SEQUENCE: StageId[] = [
  "ASSEMBLED",
  "OPEN_CASE",
  "MOTHERBOARD_OUT",
  "CPU_COOLER_OUT",
  "CPU_OUT",
  "RAM_OUT",
  "GPU_OUT",
  "STORAGE_OUT",
  "PSU_OUT",
  "SECONDARY_OUT",
  "FINAL_EXPLODE",
];

export function getStageName(id: string): string {
  return STAGE_DISPLAY_NAMES[id] ?? id;
}

export function getComponentName(id: string): string {
  return COMPONENT_DISPLAY_NAMES[id as SemanticComponentId] ?? id;
}
