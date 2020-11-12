
import SearchResult from "./SearchResult.js"


export default class SearchResults extends HTMLElement {
  constructor (hits, displayFields, isMulti) {
    super()

    this.hits = hits
    this.displayFields = displayFields
    this.isMulti = isMulti
  }

  connectedCallback () {
    for (const hit of this.hits) {
      this.appendChild(
        new SearchResult(hit._source, this.displayFields, this.isMulti)
      )
    }
  }
}

customElements.define("search-results", SearchResults)
