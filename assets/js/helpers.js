
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

export function updateUrlSearchParams(searchParams) {
  const url = new URL(location.href)
  url.search = searchParams
  history.pushState(null, document.title, url)
}
