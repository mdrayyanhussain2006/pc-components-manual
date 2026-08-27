import type { SemanticComponentId } from "../core/types";
import type { TimelineController } from "../animation/timeline-controller";
import type { InteractionController } from "../interaction/interaction-controller";
import { EducationRegistry } from "./education-registry";
import { EducationPanel } from "./education-panel";
import type {
  EducationContentModel,
  EducationPanelSnapshot,
  EducationActionItem,
} from "./types";

export interface EducationControllerOptions {
  container: HTMLElement;
  interactionController?: InteractionController;
  timelineController?: TimelineController;
  registry?: EducationRegistry;
}

export type EducationListener = (snapshot: EducationPanelSnapshot) => void;

export class EducationController {
  readonly #registry: EducationRegistry;
  readonly #panel: EducationPanel;
  #interactionController: InteractionController | null = null;
  #timelineController: TimelineController | null = null;
  #selectedComponent: SemanticComponentId | null = null;
  readonly #listeners = new Set<EducationListener>();

  constructor(options: EducationControllerOptions) {
    this.#registry = options.registry ?? new EducationRegistry();
    this.#interactionController = options.interactionController ?? null;
    this.#timelineController = options.timelineController ?? null;

    this.#panel = new EducationPanel({
      container: options.container,
      onSelectComponent: (id) => this.select(id),
      onDisassembleComponent: (id) => this.disassemble(id),
      onClearSelection: () => this.clear(),
    });
  }

  setInteractionController(controller: InteractionController | null): void {
    this.#interactionController = controller;
  }

  setTimelineController(controller: TimelineController | null): void {
    this.#timelineController = controller;
  }

  get registry(): EducationRegistry {
    return this.#registry;
  }

  get selectedComponent(): SemanticComponentId | null {
    return this.#selectedComponent;
  }

  /** Retrieve the educational model for any component. */
  getContent(id: SemanticComponentId): EducationContentModel {
    return this.#registry.get(id);
  }

  /** Handle component selection change. Updates education panel and notifies listeners. */
  select(id: SemanticComponentId | null): void {
    this.#selectedComponent = id;

    const content = id ? this.#registry.get(id) : null;
    const actions = this.#buildActions(id, content);

    // Render panel
    this.#panel.render(content, actions);

    // Sync interaction controller if not already matched
    if (this.#interactionController && this.#interactionController.selectedComponent !== id) {
      this.#interactionController.select(id);
    }

    this.#notifyListeners();
  }

  /** Clear educational selection. */
  clear(): void {
    this.select(null);
  }

  /**
   * Explicitly invoke disassembly stage for the component.
   * Pure selection does NOT trigger this automatically; user or test invokes it.
   */
  disassemble(id?: SemanticComponentId): void {
    const targetId = id ?? this.#selectedComponent;
    if (!targetId) return;

    // If target differs from current selection, update selection first
    if (this.#selectedComponent !== targetId) {
      this.select(targetId);
    }

    const metadata = this.#registry.getDisassemblyMetadata(targetId);
    const stageId = metadata.disassemblyStage ?? metadata.disconnectStage;

    if (stageId && this.#timelineController) {
      this.#timelineController.playStage(stageId);
    }
  }

  /** Get snapshot of current educational state. */
  getSnapshot(): EducationPanelSnapshot {
    const content = this.#selectedComponent ? this.#registry.get(this.#selectedComponent) : null;
    const related = this.#selectedComponent ? this.#registry.getRelated(this.#selectedComponent) : [];
    const actions = this.#buildActions(this.#selectedComponent, content);

    return {
      selectedComponent: this.#selectedComponent,
      content,
      relatedComponents: related,
      availableActions: actions,
    };
  }

  /** Subscribe to educational state updates. */
  subscribe(listener: EducationListener): () => void {
    this.#listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #buildActions(
    id: SemanticComponentId | null,
    content: EducationContentModel | null,
  ): readonly EducationActionItem[] {
    if (!id || !content) return [];

    const actions: EducationActionItem[] = [];
    const stageId = content.disassembly.disassemblyStage ?? content.disassembly.disconnectStage;

    if (stageId) {
      actions.push({
        id: "disassemble",
        label: `Disassemble: ${stageId}`,
        stageId,
        description: content.disassembly.mechanicalDescription,
      });
    }

    actions.push({
      id: "clear",
      label: "Clear Selection",
    });

    return actions;
  }

  #notifyListeners(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }

  dispose(): void {
    this.#listeners.clear();
    this.#panel.dispose();
  }
}
