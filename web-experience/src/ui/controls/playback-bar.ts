import type { TimelineSnapshot } from "../../runtime/animation/types";

export interface PlaybackBarOptions {
  container: HTMLElement;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  onReset: () => void;
}

export class PlaybackBar {
  readonly element: HTMLElement;
  readonly #options: PlaybackBarOptions;
  readonly #playPauseBtn: HTMLButtonElement;
  #playing = false;

  constructor(options: PlaybackBarOptions) {
    this.#options = options;

    this.element = document.createElement("div");
    this.element.id = "playback-bar";
    this.element.className = "playback-bar";
    this.element.setAttribute("role", "toolbar");
    this.element.setAttribute("aria-label", "Animation controls");

    const prevBtn = this.#createButton("playback-prev", "Previous stage", "◀", () => this.#options.onPrev());
    this.#playPauseBtn = this.#createButton("playback-play", "Play", "▶", () => this.#options.onPlayPause());
    const nextBtn = this.#createButton("playback-next", "Next stage", "▶", () => this.#options.onNext());
    nextBtn.style.transform = "scaleX(1)";
    const resetBtn = this.#createButton("playback-reset", "Reset to assembled", "↻", () => this.#options.onReset());

    this.element.appendChild(prevBtn);
    this.element.appendChild(this.#playPauseBtn);
    this.element.appendChild(nextBtn);
    this.element.appendChild(resetBtn);

    this.#options.container.appendChild(this.element);
  }

  update(snapshot: TimelineSnapshot | null): void {
    if (!snapshot) return;
    this.#playing = snapshot.playbackState === "playing";
    this.#playPauseBtn.textContent = this.#playing ? "❚❚" : "▶";
    this.#playPauseBtn.setAttribute("aria-label", this.#playing ? "Pause" : "Play");
  }

  #createButton(id: string, label: string, icon: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = id;
    btn.className = "playback-bar__btn";
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.textContent = icon;
    btn.addEventListener("click", onClick);
    return btn;
  }

  dispose(): void {
    this.element.remove();
  }
}
