
import SearchFacets from "./SearchFacets.js"

import {
  buildQuery,
  executeQuery,
  getIndicesDirectory,
} from "../elasticsearch.js"

import {
  createElement,
  getUrlSearchParams,
  removeChildren,
} from "../helpers.js"


export class Search extends HTMLElement {
  constructor () {
    super()

    this.indicesDirectoryIndexTitleMap = new Map()
    this.indicesDirectoryTitleIndexMap = new Map()

    this.appendChild(createElement(
      `
      <div class="container">
        <div class="row">
          <div class="col facets"></div>
          <div class="col">
            Results...
          </div>
        </div>
      </div>
      `
    ))
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

    // Execute the initial search.
    this.search()
  }

  async search () {
    /* Execute a new search based on the current URL search params and return the
       result.
     */
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
    for (let [ k, v ] of searchParams.entries()) {
      const isArray = k.endsWith("[]")
      let name = `${isArray ? k.slice(0, k.length - 2) : k}.raw`
      let values = isArray ? v : [v]
      filters.set(name, values)
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

    // Redraw the facets.
    this.renderFacets(searchResponse.aggregations)
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

    searchFacets = new SearchFacets(aggregations, includeKeys)
    searchFacetsContainerEl.appendChild(searchFacets)
  }
}

customElements.define("search-app", Search)
