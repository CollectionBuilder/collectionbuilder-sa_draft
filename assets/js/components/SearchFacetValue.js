
/******************************************************************************
* Search Facet Value Component
*
* This component is used to implement a single facet value.
*
******************************************************************************/

export class SearchFacetValue extends HTMLElement {
  constructor () {
    super()

    // Define the component's inner structure.
    this.innerHTML =
      `<span class="name"></span>
       <span class="doc-count"></span>
      `
  }

  connectedCallback () {
    // Read the custom element attributes.
    const name = this.getAttribute("value")
    const docCount = this.getAttribute("doc-count")
    const selected = this.hasAttribute("selected")

    // Update the name element.
    const nameEl = this.querySelector(".name")
    nameEl.textContent = name
    // Set the title attribute to show untruncated value on hover.
    nameEl.setAttribute("title", name)

    // Update the doc-count element.
    this.querySelector(".doc-count").textContent = selected ? "x" : docCount

    // Maybe add the "selected" class.
    if (selected) {
      this.classList.add("selected")
    }
  }
}

// Add this component to the custom elements registry.
customElements.define("search-facet-value", SearchFacetValue)
