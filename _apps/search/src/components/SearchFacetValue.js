/*
 * Search Facet Value Component
 *
 * This component is used to implement a single facet value.
 *
 */

export default class SearchFacetValue extends HTMLElement {
  constructor () {
    super()

    this.connectCount = 1
  }

  connectedCallback () {
    if (this.connectCount > 1) {
      return
    }
    this.connectCount += 1

    // Read the custom element attributes.
    const name = this.getAttribute("value")
    const docCount = this.getAttribute("doc-count")
    const selected = this.hasAttribute("selected")

    // Add Bootstrap component classes.
    this.classList.add(
      "py-1",
      "px-2",
      "btn",
      selected ? "btn-info" : "btn-light",
      "border-bottom",
      "rounded-0",
    )

    // Add custom component classes.
    this.classList.add("cursor-pointer")

    // Define the component's inner structure.
    this.innerHTML = (
      `<span class="text-truncate pr-2 name" title="${name}">${name}</span>
       <span class="ml-auto doc-count">${selected ? "x" : docCount}</span>
      `
    )
  }
}

// Add this component to the custom elements registry.
customElements.define("search-facet-value", SearchFacetValue)
