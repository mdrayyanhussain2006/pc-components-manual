import { AnimationAction, AnimationMixer, Group, LoopOnce } from "three";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ASSEMBLED_TIME, STAGES, TIMELINE_DURATION } from "./stage-data";
import { PlaybackState, StageId, TimelineSnapshot } from "./types";

export class TimelineController {
  readonly #mixer: AnimationMixer;
  readonly #actions: AnimationAction[] = [];
  
  #timelineTime: number = ASSEMBLED_TIME;
  #playbackState: PlaybackState = "idle";
  #targetStage: StageId | null = null;
  #targetTime: number | null = null;

  constructor(gltf: GLTF) {
    this.#mixer = new AnimationMixer(gltf.scene);
    
    // Initialize all 21 clips.
    // They are permanently active, clamp at the end, and run simultaneously.
    for (const clip of gltf.animations) {
      const action = this.#mixer.clipAction(clip);
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      this.#actions.push(action);
    }
    
    this.seekTimeline(ASSEMBLED_TIME);
  }

  /**
   * Instantly seek to a specific timeline position, enforcing all actions
   * evaluate at exactly this time.
   */
  private seekTimeline(time: number): void {
    this.#mixer.setTime(0); // Reset mixer global clock reference
    for (const action of this.#actions) {
      action.reset();
      action.setLoop(LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      action.time = time;
    }
    this.#mixer.update(0); // Force evaluation
    this.#timelineTime = time;
  }

  public update(delta: number): void {
    if (this.#playbackState !== "playing" || this.#targetTime === null) {
      return;
    }
    
    const newTime = this.#timelineTime + delta;
    
    if (newTime >= this.#targetTime) {
      // We reached the target time
      this.seekTimeline(this.#targetTime);
      this.#playbackState = "idle";
      this.#targetStage = null;
      this.#targetTime = null;
      return;
    }
    
    this.#timelineTime = newTime;
    this.#mixer.update(delta);
  }

  private resolveCurrentStage(time: number): StageId | null {

    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i];
      if (!stage) continue;
      
      const nextStage = STAGES[i + 1];
      
      if (nextStage) {
        if (time < nextStage.startTime) return stage.id;
        // If at the exact boundary of the next stage, but we are parked at this stage
        if (time === nextStage.startTime && time <= stage.parkTime) {
          return stage.id;
        }
      } else {
        if (time >= stage.startTime) return stage.id;
      }
    }
    return STAGES[0]?.id || null;
  }

  public playStage(id: StageId): void {
    const stage = STAGES.find(s => s.id === id);
    if (!stage) return;
    
    this.seekTimeline(stage.startTime);
    this.#targetStage = id;
    this.#targetTime = stage.parkTime;
    this.#playbackState = "playing";
  }

  public playTo(id: StageId): void {
    const stage = STAGES.find(s => s.id === id);
    if (!stage) return;
    
    this.#targetStage = id;
    this.#targetTime = stage.parkTime;
    
    // If target time is behind current time, we don't play backwards.
    // Instead we jump back to start of target and play to its park.
    if (this.#targetTime <= this.#timelineTime) {
       this.playStage(id);
       return;
    }

    this.#playbackState = "playing";
  }

  public playAll(): void {
    const finalStage = STAGES.find(s => s.id === "FINAL_EXPLODE");
    if (!finalStage) return;
    
    this.#targetStage = "FINAL_EXPLODE";
    this.#targetTime = finalStage.endTime ?? finalStage.parkTime;
    
    if (this.#targetTime <= this.#timelineTime) {
       this.seekTimeline(finalStage.startTime);
    }

    this.#playbackState = "playing";
  }

  public pause(): void {
    if (this.#playbackState === "playing") {
      this.#playbackState = "paused";
    }
  }

  public resume(): void {
    if (this.#playbackState === "paused" && this.#targetTime !== null) {
      this.#playbackState = "playing";
    }
  }

  public reset(): void {
    this.seekTimeline(ASSEMBLED_TIME);
    this.#targetStage = null;
    this.#targetTime = null;
    this.#playbackState = "idle";
  }

  public seekTo(time: number): void {
    // Clamp to valid bounds
    const clampedTime = Math.max(0, Math.min(time, TIMELINE_DURATION));
    this.seekTimeline(clampedTime);
    this.#targetStage = null;
    this.#targetTime = null;
    this.#playbackState = "idle";
  }

  public replayStage(id: StageId): void {
    this.playStage(id);
  }

  public next(): void {
    const currentIdx = STAGES.findIndex(s => s.id === this.resolveCurrentStage(this.#timelineTime));
    if (currentIdx >= 0 && currentIdx < STAGES.length - 1) {
      const nextStage = STAGES[currentIdx + 1];
      if (nextStage) this.playStage(nextStage.id);
    } else if (currentIdx === -1 && STAGES.length > 0) {
      const firstStage = STAGES[0];
      if (firstStage) this.playStage(firstStage.id);
    }
  }

  public prev(): void {
    const currentIdx = STAGES.findIndex(s => s.id === this.resolveCurrentStage(this.#timelineTime));
    if (currentIdx > 0) {
      // Because playStage seeks to the start and plays to park, 
      // previous stage will instantly jump back and play its segment.
      const prevStage = STAGES[currentIdx - 1];
      if (prevStage) this.playStage(prevStage.id);
    }
  }

  public interrupt(): void {
    this.#playbackState = "idle";
    this.#targetStage = null;
    this.#targetTime = null;
  }

  public getSnapshot(): TimelineSnapshot {
    return {
      timelineTime: this.#timelineTime,
      currentStage: this.resolveCurrentStage(this.#timelineTime),
      playbackState: this.#playbackState,
      targetStage: this.#targetStage,
    };
  }
  
  public dispose(): void {
    this.#mixer.stopAllAction();
    this.#actions.length = 0;
  }
}
