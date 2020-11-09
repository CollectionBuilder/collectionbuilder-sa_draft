
/******************************************************************************
 * A very simple pub/sub library.
 ******************************************************************************/


export const TOPICS = Object.freeze(
  Object.fromEntries(
    [
      "URL_SEARCH_PARAMS_UPDATED",
    ].map(x => [ x, x ])
  )
)

const TOPIC_SUBSCRIBERS_MAP = new Map(
  Object.keys(TOPICS).map(x => [ x, [] ])
)


export const subscribe = (topic, subscriber) =>
  TOPIC_SUBSCRIBERS_MAP.get(topic).push(subscriber)


export async function publish (topic, payload = {}) {
  // Use JSON.stringify/parse to perform a deepcopy of the payload.
  payload = JSON.stringify(payload)
  for (let subscriber of TOPIC_SUBSCRIBERS_MAP.get(topic)) {
    subscriber(JSON.parse(payload))
  }
}
