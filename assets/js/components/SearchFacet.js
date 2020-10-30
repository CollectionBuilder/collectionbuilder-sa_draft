
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
