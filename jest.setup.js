// jest.setup.js
// Configuración global para tests

// Polyfill Web APIs (Request/Response/Headers) en el sandbox VM de Jest.
// Necesario porque cualquier import de `next/server` los referencia y ni jsdom
// ni el sandbox node de Jest los exponen automáticamente. Sin esto, suites
// que toquen rutas API revientan con `ReferenceError: Request is not defined`.
// Condicional para no pisar polyfills que ya provea el entorno.
if (typeof globalThis.Request === 'undefined') {
  const nodeFetch = require('node-fetch')
  globalThis.Request = nodeFetch.Request
  globalThis.Response = nodeFetch.Response
  globalThis.Headers = nodeFetch.Headers
}

// Mock de variables de entorno
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Mock de ResizeObserver (común en tests frontend)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mock de IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

// Mocks de browser APIs (solo en jsdom, no en node)
if (typeof window !== 'undefined') {
  // Mock de window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })

  // Mock de localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  }
  global.localStorage = localStorageMock
}

// Mock de fetch global
global.fetch = jest.fn()

// Limpiar mocks después de cada test se maneja en setupFilesAfterEnv