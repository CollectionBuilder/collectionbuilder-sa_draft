
import { getUrlSearchParams, updateUrlSearchParams } from "/assets/js/helpers.js"
import { TOPICS, subscribe } from "/assets/js/pubSub.js"


/******************************************************************************
 * Clear Filters Component
 *
 * This component is used to clear any applied search filters.
 *
 ******************************************************************************/

export default class ClearFilters extends HTMLButtonElement {
  connectedCallback () {
    // Update the button content.
    this.update(getUrlSearchParams())

    // Register the click handler.
    this.addEventListener("click", this.clickHandler)

    // Subscribe update() to URL_SEARCH_PARAMS_UPDATED messages.
    subscribe(TOPICS.URL_SEARCH_PARAMS_UPDATED, this.update.bind(this))
  }

  update () {
    // Parse the unique list of applied filter keys from the current URL.
    const params = new URLSearchParams(location.search)
    // Determine the number of applied filters.
    const numApplied = Array.from(params.keys()).filter(x => x.endsWith("[]")).length

    // If no filters are applied, hide the component, otherwise update the text content
    // and show it.
    if (numApplied === 0) {
      this.classList.add("d-none")
    } else {
      this.classList.remove("d-none")
      this.textContent = `Clear ${numApplied} Filters`
    }
  }

  clickHandler (e) {
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
  }
}

customElements.define("clear-filters", ClearFilters, { extends: "button" })
