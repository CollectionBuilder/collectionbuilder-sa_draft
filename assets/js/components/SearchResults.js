
import SearchResult from "./SearchResult.js"


export default class SearchResults extends HTMLElement {
  constructor (hits, displayFields) {
    super()

    this.hits = hits
    this.displayFields = displayFields
  }

  connectedCallback () {
    for (const hit of this.hits) {
      this.appendChild(
        new SearchResult(hit._source, this.displayFields)
      )
    }
  }
}

customElements.define("search-results", SearchResults)
