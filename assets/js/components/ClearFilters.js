

/******************************************************************************
 * Clear Filters Component
 *
 * This component is used to clear any applied search filters.
 *
 ******************************************************************************/

export default class ClearFilters extends HTMLElement {
  connectedCallback () {
    // Manually invoke the attributeChangedCallback with the initial num-applied
    // property value to set the initial component state.
    this.attributeChangedCallback("num-applied", undefined,
                                  this.getAttribute("num-applied"))
  }

  static get observedAttributes () {
    // Return the array of properties for which the attributeChangedCallback will
    // be invoked when modified.
    return [ "num-applied" ]
  }

  attributeChangedCallback (name, oldValue, newValue) {
    /* Handle num-applied property changes by updating the text content and
       showing / hiding the element.
    */
    const numApplied = parseInt(newValue)
    this.textContent = `Clear ${numApplied} Filters`
    if (numApplied === 0) {
      this.classList.add("d-none")
    } else {
      this.classList.remove("d-none")
    }
  }
}

customElements.define("clear-filters", ClearFilters)
