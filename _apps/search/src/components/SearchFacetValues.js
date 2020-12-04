/*
 * Search Facet Values Component
 *
 * This component is used to contain a list of <search-facet-value> elements.
 *
 */

import { createElement } from "../lib/helpers.js"

export default class SearchFacetValues extends HTMLElement {
  constructor () {
    super()

    // Set an initial value for how many values to show by default.
    this.defaultNumVisible = 5

    // Define a flag to indicate whether we should show all the values.
    this.showAll = false

    this.connectCount = 1
  }

  initialConnectCallback () {
    // Read any specified initial-num-visible attribute.
    if (this.hasAttribute("initial-num-visible")) {
      this.defaultNumVisible = parseInt(
        this.getAttribute("initial-num-visible"), 10
      )
    }

    // Set component classes.
    this.classList.add("d-block")

    // Get all of the <search-facet-value> elements.
    const valueEls = Array.from(this.querySelectorAll("search-facet-value"))
    // Add the d-flex class to all default-visible values.
    valueEls
      .slice(0, this.defaultNumVisible)
      .forEach(el => el.classList.add("d-flex"))

    // Collect the slice of <search-facet-value> elements whose visibility we
    // need to control.
    this.valueElsSlice = valueEls.slice(this.defaultNumVisible)
    // Add the d-none class to all default-hidden values.
    this.valueElsSlice.forEach(el => el.classList.add("d-none"))

    // If the number of values exceeds defaultNumVisible, add the show more/fewer
    // button.
    if (this.valueElsSlice.length > 0) {
      // Create the show more button element.
      this.showMoreEl = createElement(
        `<button class="btn btn-info w-100 rounded-0 pt-1 pb-1 show-more">
         show more
       </button>`
      )
      // Append the show more button to the component.
      this.appendChild(this.showMoreEl)
      // Collapse the values.
      this.showAll = false
      this.showAllChangeHandler()
      // Register the show more click handler.
      this.showMoreEl.addEventListener("click", this.toggleShowAll.bind(this))
    }
  }

  connectedCallback () {
    // Invoke firstConnectCallback() on first connect and increment the
    // connect count.
    if (this.connectCount === 1) {
      this.initialConnectCallback()
    }
    this.connectCount += 1
  }

  showAllChangeHandler () {
    // Set the .show-more element's text content.
    this
      .querySelector(".show-more")
      .textContent = this.showAll ? "show fewer" : "show more"

    // Show/hide the value elements in the non-default slice.
    const classToAdd = this.showAll ? "d-flex" : "d-none"
    const classToRemove = !this.showAll ? "d-flex" : "d-none"
    this.valueElsSlice.forEach(el => {
      el.classList.add(classToAdd)
      el.classList.remove(classToRemove)
    })
  }

  toggleShowAll () {
    // Toggle the state variable.
    this.showAll = !this.showAll

    // Call the showAll update change handler.
    this.showAllChangeHandler()
  }
}

customElements.define("search-facet-values", SearchFacetValues)
