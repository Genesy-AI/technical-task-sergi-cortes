import '@testing-library/jest-dom'

// Node 25+ defines its own global localStorage, which is undefined without --localstorage-file and hides jsdom's.
// Provide an in-memory Storage so tests behave the same on every Node version.
if (!globalThis.localStorage) {
  const values = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  }
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true })
  Object.defineProperty(window, 'localStorage', { value: memoryStorage, configurable: true })
}

// jsdom does not implement matchMedia, which react-hot-toast reads to respect reduced motion.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
