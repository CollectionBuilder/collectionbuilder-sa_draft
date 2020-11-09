
import { TOPICS, publish } from "./pubSub.js"


export function createElement (DOMString) {
  // Return an HTML element object for the given DOM string.
  const wrapper = document.createElement("div")
  wrapper.innerHTML = DOMString.trim()
  const el = wrapper.firstChild
  wrapper.removeChild(el)
  return el
}

export const snakeToTitleCase = s =>
  s.split("_")
   .map(s=> s[0].toUpperCase() + s.slice(1))
   .join(" ")

export const clone = tmplEl => tmplEl.content.cloneNode(true).children[0]

export const removeChildren = el => Array.from(el.children).forEach(x => x.remove())

export function getUrlSearchParams () {
  // Parse the URL search params, collecting array-type values into actual
  // arrays and return the resulting <key> -> <value(s)> map.
  const params = new Map()
  const searchParams = new URLSearchParams(location.search)
  for (let [k, v] of searchParams.entries()) {
    const isArray = k.endsWith("[]")
    if (!params.has(k)) {
      params.set(k, isArray ? [v] : v)
    } else if (isArray) {
      params.get(k).push(v)
    } else {
      console.warn(`Duplicate search key "${k}" does not end with "[]"`)
    }
  }
  return params
}

export function updateUrlSearchParams(searchParams) {
  // Create a URL object from the current location and update its search property.
  const url = new URL(location.href)
  url.search = searchParams
  // Use pushState() to update the address bar without reloading the page.
  history.pushState(null, document.title, url)
  // Announce the update.
  publish(TOPICS.URL_SEARCH_PARAMS_UPDATED, searchParams)
}
