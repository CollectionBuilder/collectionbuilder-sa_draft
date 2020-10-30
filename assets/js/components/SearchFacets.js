
/******************************************************************************
 * Search Facets Component
 *
 * This component is used to contain a list of <search-facet> elements.
 *
 ******************************************************************************/

// Import the following component modules just to register the custom elements.
import "/assets/js/components/SearchFacet.js"
import "/assets/js/components/SearchFacetValues.js"
import "/assets/js/components/SearchFacetValue.js"

import {
  createElement,
  snakeToTitleCase,
} from "../helpers.js"


const getSelectedFacetVals = name =>
  new URLSearchParams(location.search).getAll(`${name}[]`)

// TODO
/* function clearFacetValueSelections () {
 *   // Remove all applied facets/filters from the URL search params and execute
 *   // the new search.
 *   const params = new URLSearchParams(location.search)
 *   FACETED_FIELD_NAMES.forEach(fieldName => params.delete(`${fieldName}[]`))
 *   // Delete collection[] and start if present.
 *   params.delete("collection[]")
 *   params.delete("start")
 *   updateUrlSearchParams(params)
 *   search(getSearchParams())
 * }
 *  */

export default class SearchFacets extends HTMLElement {
  constructor (aggregations, includeKeys) {
    super()

    // Save the aggregations for later.
    this.aggregations = aggregations
    this.includeKeys = includeKeys

    // Define an array for value toggle listener functions.
    this.valueClickListeners = []
  }

  connectedCallback () {
    // Iterate through the aggregations, creating a SearchFacet for each.
    for (const key of (this.includeKeys || Object.keys(this.aggregations))) {
      const buckets = this.aggregations[key].buckets

      // Sort the value by the order in which they were applied, as indicated
      // by the search URL params.
      const selectedFacetVals = getSelectedFacetVals(key).reverse()
      buckets.sort(
        (a, b) => selectedFacetVals.indexOf(b.key) - selectedFacetVals.indexOf(a.key)
      )

      // Define a helper that will create an HTML search-facet-value element
      // string from a search response aggregation bucket.
      const bucketToSearchFacetValueStr = ({ key, doc_count }) =>
        `<search-facet-value value="${key}"
                             doc-count="${doc_count}"
                             ${selectedFacetVals.includes(key) ? "selected" : ""}>
         </search-facet-value>`

      // Create the SearchFacet component.
      const searchFacetEl = createElement(
        `<search-facet name="${key}" display-name="${snakeToTitleCase(key)}">
           <search-facet-values initial-num-visible="5">
             ${buckets.map(bucketToSearchFacetValueStr).join("")}
           </search-facet-values>
         </search-facet>`
      )

      this.appendChild(searchFacetEl)

      // Register the value click listener for this facet.
      searchFacetEl.addValueClickListener(this.valueClickHandler.bind(this))
    }
  }

  addValueClickListener (fn) {
    /* Add a function to the value click listeners array.
     */
    this.valueClickListeners.push(fn)
  }

  removeValueClickListener (fn) {
    /* Remove a function from the value click listeners array.
     */
    for (const i in this.valueClickListeners) {
      if (this.valueClickListeners[i] === fn) {
        // Remove the function from the listeners array and return.
        this.valueClickListeners.splice(i, 1)
        return
      }
    }
  }

  valueClickHandler (name, value) {
    /* Invoke all registered value click listeners.
     */
    for (let fn of this.valueClickListeners) {
      fn(name, value)
    }
  }
}

customElements.define("search-facets", SearchFacets)
