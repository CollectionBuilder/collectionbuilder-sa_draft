/*
   Search Facet Components

   These components are used to implement the faceting interface on the
   Elasticsearch search page.

   The styles for these components are defined in: .../assets/css/es-search.css
*/


/******************************************************************************
* Search Facet Value Component
*
* This component is used to implement a single facet value.
*
******************************************************************************/

export class SearchFacetValue extends HTMLElement {
  constructor () {
    super()

    // Define the component's inner structure.
    this.innerHTML =
      `<span class="name"></span>
       <span class="doc-count"></span>
      `
  }

  connectedCallback () {
    // Read the custom element attributes.
    const name = this.getAttribute("value")
    const docCount = this.getAttribute("doc-count")
    const selected = this.hasAttribute("selected")

    // Update the name element.
    const nameEl = this.querySelector(".name")
    nameEl.textContent = name
    // Set the title attribute to show untruncated value on hover.
    nameEl.setAttribute("title", name)

    // Update the doc-count element.
    this.querySelector(".doc-count").textContent = selected ? "x" : docCount

    // Maybe add the "selected" class.
    if (selected) {
      this.classList.add("selected")
    }
  }
}

// Add this component to the custom elements registry.
customElements.define("search-facet-value", SearchFacetValue)


/******************************************************************************
* Search Facet Values Component
*
* This component is used to contain a list of <facet-value> elements.
*
******************************************************************************/

class SearchFacetValues extends HTMLElement {
  constructor () {
    super()

    // Set an initial value for how many values to show by default.
    this.defaultNumVisible = 5

    // Define a flag to indicate whether we should show all the values.
    this.showAll = false

    // Append the show-more/fewer element.
    this.innerHTML +=
      `<div class="show-more">
         show more
       </div>`
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
    const display = this.showAll ? "flex" : "none"
    this.valueElsSlice.forEach(el => el.style.display = display)
  }

  toggleShowAll () {
    // Toggle the state variable.
    this.showAll = !this.showAll

    // Call the showAll update change handler.
    this.showAllChangeHandler()
  }
}

customElements.define("search-facet-values", SearchFacetValues)


/******************************************************************************
* Search Facet Component
*
* This component is used to implement a single facet.
*
******************************************************************************/

export class SearchFacet extends HTMLElement {
  constructor () {
    super()

    // Define a flag to indicate whether the facet values are collapsed.
    this.collapsed = false

    // Define an array for value toggle listener functions.
    this.valueClickListeners = []

    // Define properties that will be populated within connectedCallback.
    this.name = undefined
    this.displayName = undefined

    // Grab the <search-facet-values> element so that we can later manually
    // place it into its <slot>. Note that this would happen automatically if
    // we were using a shadow DOM.
    const searchFacetValuesEl = this.querySelector("search-facet-values")

    // Define the component's inner structure.
    this.innerHTML =
      `<h1 class="name">
         <span class="name"></span>
         <span class="collapsed-icon">-</span>
       </h1>
       <!-- Define a slot for <search-facet-values> element -->
       <slot></slot>`

    // Insert the <search-facet-values> element into its slot.
    this.querySelector("slot").replaceWith(searchFacetValuesEl)
  }

  connectedCallback () {
    // Read the custom element attributes.
    this.name = this.getAttribute("name")
    this.displayName = this.getAttribute("display-name")

    // Update the component with the attribute values.
    this.querySelector("h1 > span.name").textContent = this.displayName

    // Register the facet header collapse click handler.
    this.querySelector("h1")
      .addEventListener("click", this.toggleCollapsed.bind(this))

    // Register the value click handler.
    this.querySelector("search-facet-values")
      .addEventListener("click", this.valueClickHandler.bind(this))
  }

  toggleCollapsed () {
    // Toggle the state variable.
    this.collapsed = !this.collapsed

    // Update the collapsed icon.
    this.querySelector('h1 > span.collapsed-icon').textContent =
      this.collapsed ? "+" : "-"

    // Update the search facet values display.
    // Note the assumption that both search-facet-values element has a default
    // display value of "block".
    this.querySelector("search-facet-values").style.display =
      this.collapsed ? "none" : "block"
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

  valueClickHandler (e) {
    /* Invoke all registered value click listeners.
     */
    let target = e.target.closest("search-facet-value")
    const value = target.getAttribute("value")
    for (let fn of this.valueClickListeners) {
      fn(this.name, value)
    }
  }
}

// Add this component to the custom elements registry.
customElements.define("search-facet", SearchFacet)
