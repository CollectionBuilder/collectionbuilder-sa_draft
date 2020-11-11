
/******************************************************************************
* Search Facet Values Component
*
* This component is used to contain a list of <search-facet-value> elements.
*
******************************************************************************/

export default class SearchFacetValues extends HTMLElement {
  constructor () {
    super()

    // Set an initial value for how many values to show by default.
    this.defaultNumVisible = 5

    // Define a flag to indicate whether we should show all the values.
    this.showAll = false

    // Set component classes.
    this.classList.add("d-block")

    // Append the show-more/fewer element.
    this.innerHTML +=
      `<button class="btn btn-info w-100 rounded-0 pt-1 pb-1 show-more">
         show more
       </button>`
  }

  connectedCallback () {
    // Read any specified initial-num-visible attribute.
    if (this.hasAttribute("initial-num-visible")) {
      this.defaultNumVisible = parseInt(
        this.getAttribute("initial-num-visible")
      )
    }

    // Collect the slice of <search-facet-value> elements whose visibility we
    // need to control.
    this.valueElsSlice =
      Array.from(this.querySelectorAll("search-facet-value"))
           .slice(this.defaultNumVisible)

    // If the number of values exceeds defaultNumVisible, register the
    // show-more/fewer click handler, otherwise hide the element.
    const showMoreEl = this.querySelector(".show-more")
    if (this.valueElsSlice.length > 0) {
      showMoreEl.addEventListener("click", this.toggleShowAll.bind(this))
    } else {
      showMoreEl.style.display = "none"
    }

    // Call the showAll change handler to ensure that the visible state is in
    // sync with the current this.showAll value.
    this.showAllChangeHandler()
  }

  showAllChangeHandler () {
    // Set the .show-more element's text content.
    this.querySelector(".show-more").textContent =
      this.showAll ? "show fewer" : "show more"

    // Show/hide the value elements in the non-default slice.
    const classToAdd = this.showAll ? "d-flex" : "d-none"
    const classToRemove = !this.showAll ? "d-flex" : "d-none"
    this.valueElsSlice.forEach(el => {
      el.classList.remove(classToRemove)
      el.classList.add(classToAdd)
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
