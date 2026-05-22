const store = {}
const TTL = 30_000 // 30 segundos

export function getCached(key) {
  const e = store[key]
  if (!e || Date.now() - e.ts > TTL) return null
  return e.data
}

export function setCached(key, data) {
  store[key] = { data, ts: Date.now() }
}

export function clearCached(key) {
  if (key) delete store[key]
  else Object.keys(store).forEach(k => delete store[k])
}
