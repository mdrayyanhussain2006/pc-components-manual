import type { StageId, TimelineSnapshot } from "../../runtime/animation/types";
import { STAGE_SEQUENCE, getStageName } from "./display-names";

export interface StageNavOptions {
  container: HTMLElement;
  onStageClick: (stageId: StageId) => void;
}

export class StageNav {
  readonly element: HTMLElement;
  readonly #options: StageNavOptions;
  readonly #dots: Map<StageId, HTMLButtonElement> = new Map();
  #currentStage: StageId = "ASSEMBLED";
  #targetStage: StageId | null = null;

  constructor(options: StageNavOptions) {
    this.#options = options;

    this.element = document.createElement("nav");
    this.element.id = "stage-nav";
    this.element.className = "stage-nav";
    this.element.setAttribute("aria-label", "Disassembly stages");

    const track = document.createElement("div");
    track.className = "stage-nav__track";

    for (const stageId of STAGE_SEQUENCE) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "stage-nav__dot";
      dot.dataset.stage = stageId;
      dot.setAttribute("aria-label", getStageName(stageId));
      dot.title = getStageName(stageId);

      dot.addEventListener("click", () => {
        this.#options.onStageClick(stageId);
      });

      this.#dots.set(stageId, dot);
      track.appendChild(dot);
    }

    this.element.appendChild(track);
    this.#options.container.appendChild(this.element);
    this.#updateVisual();
  }

  update(snapshot: TimelineSnapshot | null): void {
    if (!snapshot) return;
    this.#currentStage = snapshot.currentStage as StageId;
    this.#targetStage = snapshot.targetStage as StageId | null;
    this.#updateVisual();
  }

  #updateVisual(): void {
    const currentIdx = STAGE_SEQUENCE.indexOf(this.#currentStage);
    for (const [stageId, dot] of this.#dots) {
      const idx = STAGE_SEQUENCE.indexOf(stageId);
      dot.classList.toggle("stage-nav__dot--completed", idx < currentIdx);
      dot.classList.toggle("stage-nav__dot--active", stageId === this.#currentStage);
      dot.classList.toggle("stage-nav__dot--target", stageId === this.#targetStage && this.#targetStage !== this.#currentStage);
      dot.setAttribute("aria-current", stageId === this.#currentStage ? "step" : "false");
    }
  }

  dispose(): void {
    this.element.remove();
  }
}
