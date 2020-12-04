import "./SearchFacetValues.js"
import "./SearchFacetValue.js"

import SearchFacet from "./SearchFacet.js"

/*
 * Mult-Collection CTA Facet Component
 *
 * This component subclasses SearchFacet to create a call-to-action for
 * multi-collection search.
 *
 */

export default class MultiCollectionCTAFacet extends SearchFacet {
  constructor (numAdditionalCollections) {
    super()
    this.numAdditionalCollections = numAdditionalCollections
  }

  connectedCallback () {
    this.innerHTML = (
      `<search-facet-values>
        <search-facet-value
           value="Go to the multi-collection search page to access ${this.numAdditionalCollections} additional collections"
           doc-count="">
        </search-facet-value>
      </search-facet-values>`
    )

    this.setAttribute("name", "other-collections")
    this.setAttribute("display-name", "Other Collections")
    this.setAttribute("collapsed", "")

    super.connectedCallback()

    // Remove the text-truncate class from the name.
    this
      .querySelector("search-facet-value .name")
      .classList.remove("text-truncate")

    // Override the valueClickHandler to navigate to the multi-collection
    // search page.
    this.valueClickHandler = e => {
      e.stopPropagation()
      window.location.pathname = `/multi-collection-search/`
    }

  }
}

customElements.define("multi-collection-cta-facet", MultiCollectionCTAFacet)
