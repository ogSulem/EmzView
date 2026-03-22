const store = new Map();

export function cacheGet(key) {
  const item = store.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return item.value;
}

export function cacheSet(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
