// jest.afterEnv.js
// Configuración después de que el entorno esté listo

// Importar Jest DOM matchers
import '@testing-library/jest-dom'

// Mock global de next/cache: los módulos importan unstable_cache pero los
// tests (jsdom) no soportan TextEncoder/Streams que esa lib usa internamente.
// El mock pass-through ejecuta la función original sin caché — perfecto para
// tests que verifican comportamiento, no caché.
jest.mock('next/cache', () => ({
  unstable_cache: (fn) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
  unstable_noStore: jest.fn(),
}))

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks()
})