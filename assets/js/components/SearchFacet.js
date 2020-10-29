
import { createElement } from "../helpers.js"


/******************************************************************************
* Search Facet Value Component
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

    // Update the component with the attribute values.
    this.querySelector(".name").textContent = name
    this.querySelector(".doc-count").textContent = docCount
  }
}

// Add this component to the custom elements registry.
customElements.define("search-facet-value", SearchFacetValue)



/******************************************************************************
* Search Facet Values Component
******************************************************************************/

class SearchFacetValues extends HTMLElement {}

customElements.define("search-facet-values", SearchFacetValues)


/******************************************************************************
* Search Facet Component
******************************************************************************/

export class SearchFacet extends HTMLElement {
  constructor () {
    super()

    // Grab the <search-facet-values> element so that we can later manually
    // place it into its <slot>. Note that this would happen automatically if
    // we were using a shadow DOM.
    const searchFacetValuesEl = this.querySelector("search-facet-values")

    // Define the component's inner structure.
    this.innerHTML =
      `<h1 class="name">
         <span class="collapsed-icon">-</span>
       </h1>
       <!-- Define a slot for <search-facet-values> element -->
       <slot></slot>
       <div class="show-more">
         show fewer
       </div>`

    // Insert the <search-facet-values> element into its slot.
    this.querySelector("slot").replaceWith(searchFacetValuesEl)
  }

  connectedCallback () {
    // Read the custom element attributes.
    const name = this.getAttribute("name")

    // Update the component with the attribute values.
    this.querySelector('h1.name').insertBefore(
      document.createTextNode(name),
      this.querySelector('h1 > span.collapsed-icon')
    )
  }
}

// Add this component to the custom elements registry.
customElements.define("search-facet", SearchFacet)
