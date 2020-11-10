
import "./ClearFilters.js"

import SearchFacets from "./SearchFacets.js"
import SearchResultsHeader from "./SearchResultsHeader.js"
import SearchResults from "./SearchResults.js"

import {
  buildQuery,
  executeQuery,
  getIndicesDirectory,
} from "../elasticsearch.js"

import {
  createElement,
  getUrlSearchParams,
  removeChildren,
  updateUrlSearchParams,
} from "../helpers.js"


export class Search extends HTMLElement {
  constructor () {
    super()

    this.indicesDirectoryIndexTitleMap = new Map()
    this.indicesDirectoryTitleIndexMap = new Map()

    this.appendChild(createElement(
      `
      <div class="container position-relative">

        <div class="position-absolute w-100 h-100 search-overlay">
          <div class="spinner-border" role="status">
            <span class="sr-only">Loading...</span>
          </div>
        </div>

        <div class="row">
          <div class="col-4 facets"></div>
          <div class="col">
            <input type="text" class="form-control mb-2" placeholder="Search" aria-label="search box">
            <clear-filters num-applied="0"></clear-filters>
            <div class="results-header"></div>
            <div class="results"></div>
          </div>
        </div>
      </div>
      `
    ))

    this.searchOverlay = this.querySelector(".search-overlay")
    this.clearFiltersButton = this.querySelector("clear-filters")

    // Initialize the search input value from the URL search params.
    this.searchInput = this.querySelector("input[type=text]")
    const searchParams = getUrlSearchParams()
    if (searchParams.has("q")) {
      this.searchInput.value = searchParams.get("q")
    }

  }

  async connectedCallback () {
    // Parse the Elasticsearch URL value.
    const elasticsearchUrl = this.getAttribute("elasticsearch-url")
    try {
      // Use the origin property value which discards trailing slashes.
      this.esUrl = new URL(elasticsearchUrl).origin
    } catch (e) {
      throw 'Please specify a valid <es-search> element "elasticsearch-url" value'
    }

    // Parse the list of all fields.
    if (this.hasAttribute("fields")) {
      let fields = this.getAttribute("fields")
      // Split the list of comma-separated field names.
      fields = fields.split(",")
      // Ignore the trailing empty element and assign to this.
      this.allFields = fields.slice(0, fields.length - 1)
    } else {
      this.allFields = []
    }

    // Parse the list of faceted fields.
    if (this.hasAttribute("faceted-fields")) {
      let facetedFields = this.getAttribute("faceted-fields")
      // Split the list of comma-separated field names.
      facetedFields = facetedFields.split(",")
      // Ignore the trailing empty element and assign to this.
      this.facetedFields = facetedFields.slice(0, facetedFields.length - 1)
    } else {
      this.facetedFields = []
    }

    // Parse the list of display fields.
    if (this.hasAttribute("display-fields")) {
      let displayFields = this.getAttribute("display-fields")
      // Split the list of comma-separated field names.
      displayFields = displayFields.split(",")
      // Ignore the trailing empty element and assign to this.
      this.displayFields = displayFields.slice(0, displayFields.length - 1)
    } else {
      this.displayFields = []
    }

    // Parse the search-multi property.
    const isMulti = this.hasAttribute("search-multi")

    // Get the indices directory data and use it to init the title/index maps.
    for (const { index, title } of (await getIndicesDirectory(this.esUrl))) {
      this.indicesDirectoryIndexTitleMap.set(index, title)
      this.indicesDirectoryTitleIndexMap.set(title, index)
    }

    // Register the search input keydown handler.
    this.searchInput.addEventListener("keydown", this.searchInputKeydownHandler.bind(this))

    // Register the clear filters button click handler.
    this.clearFiltersButton
      .addEventListener("click", this.clearFiltersClickHandler.bind(this))

    // Execute the initial search.
    this.search()
  }

  async search () {
    /* Execute a new search based on the current URL search params and return the
       result.
     */
    // Show the search overlay spinner.
    this.searchOverlay.style.display = "flex"

    const searchParams = getUrlSearchParams()

    // Set the array of indices to search against.
    let indiceTitles
    if (!this.isMulti) {
      indiceTitles = [ "{{ site.title }}" ]
    } else {
      indiceTitles = searchParams.get("collection[]")
      if (!indiceTitles) {
        // Search all collections if none is specified.
        indiceTitles = Array.from(this.indicesDirectoryTitleIndexMap.keys())
      } else {
        // Delete collection[] from the searchParams to prevent
        // it being specified as filter.
        searchParams.delete("collection[]")
      }
    }
    const indices = indiceTitles.map(x => this.indicesDirectoryTitleIndexMap.get(x))

    // Get any query string.
    const q = searchParams.pop("q") || ""

    // Get any paging values.
    const start = parseInt(searchParams.pop("start") || 0)
    const size = parseInt(searchParams.pop("size") || 10)

    // Get any list of fields on which to search.
    let fields = ["*"]
    if (searchParams.has("fields")) {
      fields = searchParams.pop("fields").split(",")
    }

    // Define which document fields to retrieve.
    const _source = {
      excludes: [
        "full_text"
      ]
    }

    // Use the remaining searchParams entries to build the filters list.
    let filters = new Map()
    // Count the total number of applied filter values.
    let numAppliedFilters = 0
    for (let [ k, v ] of searchParams.entries()) {
      const isArray = k.endsWith("[]")
      let name = `${isArray ? k.slice(0, k.length - 2) : k}.raw`
      let values = isArray ? v : [v]
      filters.set(name, values)
      numAppliedFilters += values.length
    }

    // Define the aggregations.
    let aggregationNameFieldMap = new Map()
    for (const name of this.facetedFields) {
      aggregationNameFieldMap.set(name, `${name}.raw`)
    }

    const searchQuery = buildQuery(indices, { q, filters, start, size, fields,
                                              aggregationNameFieldMap, _source })

    const allIndices = Array.from(this.indicesDirectoryIndexTitleMap.keys())

    // Create a count query that counts hits across all indices and returns
    // no documents.
    const countQuery = {
      size: 0,
      query: searchQuery.query,
      aggs: {
        collection: {
          terms: {
            field: "_index",
            size: allIndices.length
          }
        }
      }
    }

    const [ searchResponse, countResponse ] = await Promise.all([
      executeQuery(this.esUrl, indices, searchQuery),
      executeQuery(this.esUrl, allIndices, countQuery),
    ])

    // Augment the search response with the count response collection aggregation.
    const collectionAgg = countResponse.aggregations.collection
    // Add zero-count buckets for any unrepresented indices.
    const representedIndices = collectionAgg.buckets.map(({ key }) => key)
    for (const indice of allIndices.filter(x => !representedIndices.includes(x))) {
      collectionAgg.buckets.push({ key: indice, doc_count: 0 })
    }
    // Swap the indice names with their titles.
    for (const bucket of collectionAgg.buckets) {
      bucket.key = this.indicesDirectoryIndexTitleMap.get(bucket.key)
    }
    searchResponse.aggregations.collection = collectionAgg

    // Update the clear filters button.
    this.clearFiltersButton.setAttribute("num-applied", numAppliedFilters)

    // Render the facets.
    this.renderFacets(searchResponse.aggregations)

    // Render the results header.
    this.renderResultsHeader(searchResponse.hits.total.value, start, size)

    // Render the results.
    this.renderResults(searchResponse.hits.hits)

    // Hide the search overlay spinner.
    this.searchOverlay.style.display = "none"
  }

  async renderFacets (aggregations) {
    /* Reinstantiate the SearchFacets component with the specified aggregations.
     */
    // Get the facets container element and remove any existing <search-facets> element.
    const searchFacetsContainerEl = this.querySelector("div.facets")
    let searchFacets = searchFacetsContainerEl.querySelector("search-facets")
    if (searchFacets !== null) {
      searchFacets.remove()
    }

    // Get the ordered array of facet names.
    let includeKeys = this.facetedFields

    // If this is the multi-search page, include a collection facet.
    if (this.isMulti) {
      includeKeys = [ "collection" ].concat(includeKeys)
    }

    // Instantiate the SearchFacets component.
    searchFacets = new SearchFacets(aggregations, includeKeys)

    // Register the facet value click handler.
    searchFacets.addValueClickListener(this.facetValueClickHandler.bind(this))

    // Append the component to the container.
    searchFacetsContainerEl.appendChild(searchFacets)
  }

  async renderResultsHeader (numHits, start, size) {
    // Get the results header container and remove any existing children.
    const container = this.querySelector("div.results-header")
    removeChildren(container)

    const searchResultsHeader = new SearchResultsHeader(numHits, start, size)
    container.appendChild(searchResultsHeader)

    // Register the page size selector change handler.
    searchResultsHeader.querySelector("select[is=page-size-selector]")
    .addEventListener("change", this.pageSizeSelectorChangeHandler.bind(this))

  }

  async renderResults (hits) {
    /* Reinstantiate the SearchResults component with the specified hits.
     */
    // Get the results container element and remove any existing <search-results> element.
    const searchResultsContainerEl = this.querySelector("div.results")
    let searchResults = searchResultsContainerEl.querySelector("search-results")
    if (searchResults !== null) {
      searchResults.remove()
    }

    // Instantiate the SearchFacets component.
    searchResults = new SearchResults(hits, this.displayFields)

    // Append the component to the container.
    searchResultsContainerEl.appendChild(searchResults)
  }

  facetValueClickHandler (name, value) {
    /* Handle a facet value click by updating the URL search params and initiating
       a new search.
    */
    const params = new URLSearchParams(location.search)
    const paramKey = `${name}[]`
    let paramVals = params.getAll(paramKey)

    if (paramVals.includes(value)) {
      paramVals = paramVals.filter(x => x !== value)
    } else {
      paramVals.push(value)
    }
    params.delete(paramKey)
    paramVals.forEach(v => params.append(paramKey, v))

    // Delete any start param.
    params.delete("start")

    updateUrlSearchParams(params)
    this.search()
  }

  searchInputKeydownHandler (e) {
    /* Execute a new search when the user presse the Enter button inside the
       text input box.
    */
    if (e.key !== "Enter") {
      return
    }
    const el = e.target
    // Blur the input.
    el.blur()
    // Update the URL 'q' search param.
    const q = el.value
    const params = new URLSearchParams(location.search)
    params.set("q", q)
    updateUrlSearchParams(params)

    this.search()
  }

  pageSizeSelectorChangeHandler (e) {
    /* Execute a new search when the page size selector is changed.
    */
    // Update the URL 'q' search param.
    const size = e.target.value
    const params = new URLSearchParams(location.search)
    params.set("size", size)
    updateUrlSearchParams(params)
    this.search()
  }

  clearFiltersClickHandler (e) {
    /* Handler a click on the clear-filters button.
    */
    e.stopPropagation()

    // Parse the unique list of applied filter keys from the current URL.
    const params = new URLSearchParams(location.search)
    const filterKeys = new Set(Array.from(params.keys()).filter(x => x.endsWith("[]")))

    // Delete all filter params.
    for (const k of filterKeys) {
      params.delete(k)
    }

    // Also delete start if present.
    params.delete("start")

    // Update the URL search params.
    updateUrlSearchParams(params)

    // Execute a new search.
    this.search()
  }
}

customElements.define("search-app", Search)
