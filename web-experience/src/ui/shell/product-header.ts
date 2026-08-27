export class ProductHeader {
  readonly element: HTMLElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement("header");
    this.element.id = "product-header";
    this.element.className = "product-header";
    this.element.setAttribute("aria-label", "Product title");

    this.element.innerHTML = `
      <h1 class="product-title">PC Anatomy</h1>
      <p class="product-subtitle">Interactive Technical Visualization</p>
    `;

    container.appendChild(this.element);
  }

  /** Fade out header when a component is selected, fade back on deselect. */
  setFaded(faded: boolean): void {
    this.element.classList.toggle("product-header--faded", faded);
  }

  dispose(): void {
    this.element.remove();
  }
}
