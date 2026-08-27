import type { RuntimeReadinessState, RuntimeStateListener } from "./types";

export class RuntimeStateStore {
  readonly #listeners = new Set<RuntimeStateListener>();
  #state: RuntimeReadinessState;

  constructor(initialState: RuntimeReadinessState) {
    this.#state = initialState;
  }

  getState(): RuntimeReadinessState {
    return this.#state;
  }

  setState(state: RuntimeReadinessState): void {
    this.#state = state;
    document.documentElement.dataset.runtimeState = state.status;
    for (const listener of this.#listeners) {
      listener(state);
    }
  }

  subscribe(listener: RuntimeStateListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  clear(): void {
    this.#listeners.clear();
  }
}
