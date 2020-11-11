
import "./Paginator.js"

import { createElement } from "../helpers.js"


/******************************************************************************
* Search Results Header Component
*
* This component displays search results stats and paging controls.
*
******************************************************************************/

export default class SearchResultsHeader extends HTMLElement {
  constructor (numHits, start, size) {
    super()

    this.numHits = numHits
    this.start = start
    this.size = size
    this.startIdx = start + 1
    this.endIdx = this.startIdx + Math.min(numHits - this.startIdx, size - 1)

    this.classList.add("d-flex")
  }

  connectedCallback () {
     // Display an error message if the start value is invalid.
     if (this.endIdx < this.startIdx) {
       this.classList.add("bg-warning", "text-dark", "p-3")
       this.textContent =
         `Query "start" value (${this.start}) exceeds the number of total ` +
         `results (${this.numHits})`
       return
     }

    this.innerHTML =
      `<span class="h4 text-nowrap">
         Showing ${this.startIdx} - ${this.endIdx} of ${this.numHits} Results
       </span>
       <div class="ml-auto text-right">
         <span class="text-nowrap">
           <label for="results-per-page">Results per page</label>
           <select is="page-size-selector" value="${this.size}" options="10,25,50,100"
                   class="cursor-pointer">
           </select>
         </span>
         <paginator-control num-total="${this.numHits}" page-size="${this.size}"
                            current-page="${Math.floor(this.startIdx / this.size) + 1}"
                            class="d-block mt-1 mb-2">
         </paginator-control>
       </div>
      `
  }
}

customElements.define("search-results-header", SearchResultsHeader)


/******************************************************************************
* Page Size Selector Component
*
* This component is used to change the search results page size.
*
******************************************************************************/

class PageSizeSelector extends HTMLSelectElement {
  constructor () {
    super()

    this.classList.add("bg-white")
  }

  connectedCallback () {
    const initialValue = this.getAttribute("value")
    const options = this.getAttribute("options").split(",")

    // If value is not in options, add it.
    if (!options.includes(initialValue)) {
      options.push(initialValue)
    }

    // Add the option elements.
    for (const value of options) {
      this.appendChild(createElement(
        `<option value="${value}"
                 ${value === initialValue ? "selected" : ""}>
           ${value}
         </option>
        `
      ))
    }
  }
}

customElements.define("page-size-selector", PageSizeSelector, { extends: "select" })
