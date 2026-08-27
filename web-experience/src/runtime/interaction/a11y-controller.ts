import { SEMANTIC_COMPONENT_IDS, type SemanticComponentId } from "../core/types";

export interface A11yControllerOptions {
  container: HTMLElement;
  onHover: (id: SemanticComponentId | null) => void;
  onSelect: (id: SemanticComponentId) => void;
}

export class A11yController {
  readonly #container: HTMLElement;
  readonly #options: A11yControllerOptions;
  readonly #buttons = new Map<SemanticComponentId, HTMLButtonElement>();
  
  #disposed = false;

  constructor(options: A11yControllerOptions) {
    this.#options = options;
    
    // Create an overlay container for the visually hidden buttons
    this.#container = document.createElement("div");
    this.#container.style.position = "absolute";
    this.#container.style.top = "0";
    this.#container.style.left = "0";
    this.#container.style.width = "100%";
    this.#container.style.height = "100%";
    this.#container.style.pointerEvents = "none";
    this.#container.style.overflow = "hidden";
    
    options.container.prepend(this.#container);

    this.#buildButtons();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    
    for (const button of this.#buttons.values()) {
      button.removeEventListener("focus", this.#handleFocus);
      button.removeEventListener("blur", this.#handleBlur);
      button.removeEventListener("click", this.#handleClick);
    }
    this.#buttons.clear();
    
    if (this.#container.parentElement) {
      this.#container.parentElement.removeChild(this.#container);
    }
  }

  // Allow programmatic focus synchronization
  syncFocus(id: SemanticComponentId | null): void {
    if (id) {
      const button = this.#buttons.get(id);
      // We only call focus() if it's not already the active element to prevent loops
      if (button && document.activeElement !== button) {
        button.focus({ preventScroll: true });
      }
    } else {
      if (document.activeElement instanceof HTMLButtonElement && 
          Array.from(this.#buttons.values()).includes(document.activeElement)) {
        (document.activeElement as HTMLElement).blur();
      }
    }
  }

  #buildButtons(): void {
    for (const id of SEMANTIC_COMPONENT_IDS) {
      const button = document.createElement("button");
      button.textContent = `Select ${id.replace(/_/g, " ")}`;
      button.setAttribute("data-component-id", id);
      
      // Visually hidden but focusable
      button.style.position = "absolute";
      button.style.width = "1px";
      button.style.height = "1px";
      button.style.padding = "0";
      button.style.margin = "-1px";
      button.style.overflow = "hidden";
      button.style.clip = "rect(0, 0, 0, 0)";
      button.style.whiteSpace = "nowrap";
      button.style.border = "0";
      // Allow it to receive focus events but not intercept pointer events
      button.style.pointerEvents = "auto";
      
      button.addEventListener("focus", this.#handleFocus);
      button.addEventListener("blur", this.#handleBlur);
      button.addEventListener("click", this.#handleClick);
      
      this.#container.appendChild(button);
      this.#buttons.set(id, button);
    }
  }

  readonly #handleFocus = (e: FocusEvent): void => {
    const target = e.target as HTMLButtonElement;
    const id = target.getAttribute("data-component-id") as SemanticComponentId | null;
    if (id) {
      this.#options.onHover(id);
    }
  };

  readonly #handleBlur = (): void => {
    this.#options.onHover(null);
  };

  readonly #handleClick = (e: MouseEvent): void => {
    const target = e.currentTarget as HTMLButtonElement;
    const id = target.getAttribute("data-component-id") as SemanticComponentId | null;
    if (id) {
      this.#options.onSelect(id);
    }
  };
}
