
import { createElement } from "../helpers.js"


/******************************************************************************
* Search Facet Value Component
******************************************************************************/

export class SearchFacetValue extends HTMLElement {
  constructor () {
    super()

    // Create the inner component element.
    const el = createElement(
      `<div class="value">
         <span class="value-name"></span>
         <span class="value-doc-count"></span>
       </div>`
    )

    // Append the inner element to the component.
    this.appendChild(el)
  }

  connectedCallback () {
    // Read the custom element attributes.
    const name = this.getAttribute("value")
    const docCount = this.getAttribute("doc-count")

    // Update the component with the attribute values.
    this.querySelector(".value-name").textContent = name
    this.querySelector(".value-doc-count").textContent = docCount
  }
}

// Add this component to the custom elements registry.
customElements.define("search-facet-value", SearchFacetValue)


/******************************************************************************
* Search Facet Component
******************************************************************************/

export class SearchFacet extends HTMLElement {
  constructor () {
    super()

    // Create the inner component element.
    const el = createElement(
      `<div class="wrapper">
         <h1 class="name">
          <span class="collapsed-icon">-</span>
        </h1>
        <div class="values"></div>
        <div class="show-more">
          show fewer
        </div>
      </div>`
    )

    // Append the inner element to the component.
    this.appendChild(el)
  }

  connectedCallback () {
    // Read the custom element attributes.
    const name = this.getAttribute("name")

    // Update the component with the attribute values.
    this.querySelector('.name').insertBefore(
      document.createTextNode(name),
      this.querySelector('.collapsed-icon')
    )

    // Move all the <search-facet-value> elements into the values div.
    // Normally we'd use <slot> for this but can't because we're not using a
    // shadow DOM.
    const valuesEl = this.querySelector(".values")
    this.querySelectorAll("search-facet-value").forEach(
      el => valuesEl.appendChild(el)
    )
  }
}

// Add this component to the custom elements registry.c
customElements.define("search-facet", SearchFacet)
