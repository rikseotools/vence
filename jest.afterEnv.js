// jest.afterEnv.js
// Configuración después de que el entorno esté listo

// Importar Jest DOM matchers
import '@testing-library/jest-dom'

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks()
})