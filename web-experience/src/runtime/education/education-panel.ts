import type { SemanticComponentId } from "../core/types";
import type { EducationContentModel, EducationActionItem } from "./types";
import { getComponentName, getStageName } from "../../ui/shell/display-names";

export interface EducationPanelOptions {
  container: HTMLElement;
  onSelectComponent: (id: SemanticComponentId) => void;
  onDisassembleComponent: (id: SemanticComponentId) => void;
  onClearSelection: () => void;
}

export class EducationPanel {
  readonly #options: EducationPanelOptions;
  readonly #element: HTMLElement;
  #currentContent: EducationContentModel | null = null;
  #currentActions: readonly EducationActionItem[] = [];
  #detailsExpanded = false;

  constructor(options: EducationPanelOptions) {
    this.#options = options;
    this.#element = document.createElement("section");
    this.#element.id = "education-panel";
    this.#element.className = "education-panel";
    this.#element.setAttribute("role", "region");
    this.#element.setAttribute("aria-label", "Component Educational Information");
    this.#element.hidden = true;

    this.#options.container.appendChild(this.#element);
  }

  get element(): HTMLElement {
    return this.#element;
  }

  render(content: EducationContentModel | null, actions: readonly EducationActionItem[] = []): void {
    this.#currentContent = content;
    this.#currentActions = actions;
    this.#detailsExpanded = false;

    if (!content) {
      this.#element.hidden = true;
      this.#element.innerHTML = "";
      return;
    }

    this.#element.hidden = false;

    const disAction = actions.find((a) => a.id === "disassemble");
    const stageDisplayName = disAction?.stageId ? getStageName(disAction.stageId) : null;

    const disActionHtml = disAction && stageDisplayName
      ? `<button type="button" class="edu-action-btn edu-btn-disassemble" data-action="disassemble" aria-label="${stageDisplayName}">
           <span>${stageDisplayName}</span>
         </button>`
      : "";

    // Connection chips with human-readable names
    const connectionChipsHtml = content.connections.length > 0
      ? `<div class="edu-connections">
           <div class="edu-chips-row" role="list">
             ${content.connections
               .map(
                 (conn) =>
                   `<button type="button" class="edu-chip" data-component-target="${conn.target}" title="${conn.description}" role="listitem">
                      <span class="edu-chip-type">${this.#formatConnectionType(conn.type)}</span>
                      <span class="edu-chip-label">${getComponentName(conn.target)}</span>
                    </button>`,
               )
               .join("")}
           </div>
         </div>`
      : "";

    // Purpose & learning points in collapsible details
    const learningPointsHtml = content.keyLearningPoints.length > 0
      ? `<div class="edu-section edu-learning-points">
           <h3 class="edu-section-title">Key Learning Points</h3>
           <ul class="edu-points-list">
             ${content.keyLearningPoints.map((pt) => `<li>${pt}</li>`).join("")}
           </ul>
         </div>`
      : "";

    const categoryLabel = this.#formatCategory(content.category);

    this.#element.innerHTML = `
      <div class="edu-card">
        <header class="edu-header">
          <div class="edu-header-meta">
            <span class="edu-category-badge">${categoryLabel}</span>
            ${content.instanceMetadata ? `<span class="edu-instance-badge">${content.instanceMetadata.slotLabel}</span>` : ""}
          </div>
          <button type="button" class="edu-close-btn" data-action="clear" aria-label="Close component details">×</button>
        </header>

        <h2 class="edu-title" id="edu-panel-title">${content.displayName}</h2>
        <p class="edu-short-desc">${content.shortDescription}</p>

        ${connectionChipsHtml}

        <button type="button" class="edu-details-toggle" aria-expanded="false" aria-controls="edu-details-body">
          <span class="chevron">▸</span> More details
        </button>
        <div id="edu-details-body" class="edu-details-body">
          <div class="edu-section edu-purpose">
            <h3 class="edu-section-title">Purpose &amp; Function</h3>
            <p class="edu-purpose-text">${content.purpose}</p>
          </div>
          ${learningPointsHtml}
        </div>

        <footer class="edu-footer">
          ${disActionHtml}
          <button type="button" class="edu-action-btn edu-btn-clear" data-action="clear">Deselect</button>
        </footer>
      </div>
    `;

    this.#attachListeners();
  }

  #formatCategory(cat: string): string {
    const map: Record<string, string> = {
      chassis: "Chassis",
      compute: "Compute",
      memory: "Memory",
      graphics: "Graphics",
      storage: "Storage",
      power: "Power",
      cooling: "Cooling",
      connectivity: "Connectivity",
    };
    return map[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
  }

  #formatConnectionType(type: string): string {
    const map: Record<string, string> = {
      mounts_on: "On",
      mounted_by: "Holds",
      connects_to: "→",
      powers: "Powers",
      receives_power: "Power",
      encloses: "Wraps",
      enclosed_by: "In",
      routes_to: "→",
      cools: "Cools",
      cooled_by: "Cooled",
      communicates_with: "Bus",
    };
    return map[type] ?? "·";
  }

  #attachListeners(): void {
    // Clear / Close buttons
    const clearButtons = this.#element.querySelectorAll<HTMLButtonElement>('[data-action="clear"]');
    clearButtons.forEach((btn) => {
      btn.addEventListener("click", () => this.#options.onClearSelection());
    });

    // Disassemble button
    const disButton = this.#element.querySelector<HTMLButtonElement>('[data-action="disassemble"]');
    if (disButton && this.#currentContent) {
      const cid = this.#currentContent.id;
      disButton.addEventListener("click", () => this.#options.onDisassembleComponent(cid));
    }

    // Connection chips
    const chips = this.#element.querySelectorAll<HTMLButtonElement>("[data-component-target]");
    chips.forEach((chip) => {
      const targetId = chip.getAttribute("data-component-target") as SemanticComponentId;
      if (targetId) {
        chip.addEventListener("click", () => this.#options.onSelectComponent(targetId));
      }
    });

    // Progressive disclosure toggle
    const toggle = this.#element.querySelector<HTMLButtonElement>(".edu-details-toggle");
    const body = this.#element.querySelector<HTMLElement>("#edu-details-body");
    if (toggle && body) {
      toggle.addEventListener("click", () => {
        this.#detailsExpanded = !this.#detailsExpanded;
        toggle.setAttribute("aria-expanded", String(this.#detailsExpanded));
        body.classList.toggle("edu-details-body--open", this.#detailsExpanded);
      });
    }
  }

  dispose(): void {
    this.#element.remove();
  }
}
