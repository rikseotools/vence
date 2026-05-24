import {
  shouldRouteToBackend,
  backendUrlFor,
  _isFlagEnabledForTests,
  type BackendEndpoint,
} from '@/lib/api/backend-router'

describe('lib/api/backend-router', () => {
  describe('shouldRouteToBackend', () => {
    it('devuelve false para medals cuando el flag está OFF', () => {
      // Estado inicial del canary: flag OFF. Cuando se active a true, este
      // test debe actualizarse para reflejar el cambio explícitamente —
      // así el activador deja huella en el diff de tests.
      expect(_isFlagEnabledForTests('medals')).toBe(false)
      expect(shouldRouteToBackend('medals')).toBe(false)
    })
  })

  describe('backendUrlFor', () => {
    it('construye URL absoluta con path tal cual', () => {
      expect(backendUrlFor('api/medals?userId=abc')).toBe(
        'https://api.vence.es/api/medals?userId=abc',
      )
    })

    it('normaliza barras iniciales del path (no duplica //)', () => {
      expect(backendUrlFor('/api/medals')).toBe('https://api.vence.es/api/medals')
      expect(backendUrlFor('///api/medals')).toBe('https://api.vence.es/api/medals')
    })

    it('preserva query string y caracteres especiales', () => {
      const userId = '3260627f-2018-4a5e-8234-e6f07015abb9'
      expect(backendUrlFor(`api/medals?userId=${userId}`)).toBe(
        `https://api.vence.es/api/medals?userId=${userId}`,
      )
    })
  })

  describe('contrato de tipos', () => {
    it('TypeScript rechaza endpoints no declarados', () => {
      // Smoke test conceptual: BackendEndpoint es el conjunto cerrado.
      // El @ts-expect-error debe seguir activo cuando se añadan endpoints
      // — si pasa a no-error, es que alguien hizo el type any.
      const valid: BackendEndpoint = 'medals'
      expect(valid).toBe('medals')

      // @ts-expect-error — 'not-a-real-endpoint' no está en FLAGS
      const invalid: BackendEndpoint = 'not-a-real-endpoint'
      expect(typeof invalid).toBe('string')
    })
  })
})
