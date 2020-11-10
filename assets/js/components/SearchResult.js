
import {
  createElement,
  snakeToTitleCase,
} from "../helpers.js"


export default class SearchResult extends HTMLElement {
  constructor (doc, displayFields) {
    super()

    this.innerHTML =
      `<a href="${doc.url}">
         <img src="${doc.thumbnailContentUrl}">
       </a>
       <div class="details">
         <h1 class="h4 ml-3">
           <a href="${doc.url}">${doc[displayFields[0]]}</a>
         </h1>
         <!-- Non-title display fields will be appended here -->
       </div>`

    // Append a detail element for all remaining displayFields.
    const detailsEl = this.querySelector(".details")
    for (const field of displayFields.slice(1)) {
      const value = doc[field]
      if (value !== undefined) {
        detailsEl.appendChild(createElement(
          `<p class="ml-3 mb-1">${snakeToTitleCase(field)}: ${value}</p>`
        ))
      }
    }

  }
}

customElements.define("search-result", SearchResult)
