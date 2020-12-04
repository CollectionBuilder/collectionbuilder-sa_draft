/*
 * Page Size Selector Component
 *
 * This component is used to change the search results page size.
 *
 */

import { createElement } from "../lib/helpers.js"

export default class PageSizeSelector extends HTMLSelectElement {
  connectedCallback () {
    this.classList.add("bg-white")

    const initialValue = this.getAttribute("value")
    const options = this.getAttribute("options").split(",")

    // If value is not in options, add it.
    if (!options.includes(initialValue)) {
      options.push(initialValue)
    }

    // Add the option elements.
    options.forEach(value => {
      this.appendChild(createElement(
        `<option value="${value}"
                 ${value === initialValue ? "selected" : ""}>
           ${value}
         </option>
        `
      ))
    })
  }
}

customElements.define("page-size-selector", PageSizeSelector, { extends: "select" })
