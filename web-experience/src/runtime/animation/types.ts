export type StageId =
  | "ASSEMBLED"
  | "OPEN_CASE"
  | "MOTHERBOARD_OUT"
  | "CPU_COOLER_OUT"
  | "CPU_OUT"
  | "RAM_OUT"
  | "GPU_OUT"
  | "STORAGE_OUT"
  | "PSU_OUT"
  | "SECONDARY_OUT"
  | "FINAL_EXPLODE";

export interface StageDefinition {
  readonly id: StageId;
  readonly startTime: number; // in seconds
  readonly parkTime: number;  // in seconds
  readonly endTime?: number;  // in seconds (for FINAL_EXPLODE)
}

export type PlaybackState = "idle" | "playing" | "paused";

export interface TimelineSnapshot {
  timelineTime: number;
  currentStage: StageId | null;
  playbackState: PlaybackState;
  targetStage: StageId | null;
}
