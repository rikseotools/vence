/**
 * T-210 (28/07/2026): separar RUIDO de DAÑO en los `console.error` de cliente.
 *
 * El caso que lo motiva, medido: 4.840 `console_error`/24 h, el 95% del ruido de error del
 * sistema, con `Failed to fetch` como mensaje dominante y 396 usuarios distintos en 3 días.
 * La misma petición abortada se suprimía en el wrapper de fetch y se registraba a severidad
 * completa desde el `catch` de la app. Con eso, la señal de cliente era inaccionable.
 *
 * La regla NO puede silenciar los fallos de red de verdad: solo los que ocurren cuando la
 * página se está yendo. Estos tests fijan justo esa frontera.
 */
import { esRuidoDeConsola } from '../../lib/observability/consoleNoise'

describe('esRuidoDeConsola', () => {
  describe('ruido de terceros / esperado (siempre)', () => {
    test.each([
      '[GSI_LOGGER]: FedCM get() rejects with NetworkError: Error retrieving a token.',
      '[GSI_LOGGER]: FedCM get() rejects with AbortError: signal is aborted without reason',
      'Error cargando notificaciones: Error: disputes/notifications 401',
    ])('%s → ruido', (msg) => {
      expect(esRuidoDeConsola(msg)).toBe(true)
      expect(esRuidoDeConsola(msg, { leaving: true })).toBe(true)
    })
  })

  describe('fallo de red: depende de si la página se está yendo', () => {
    const red = 'Error cargando notificaciones: TypeError: Failed to fetch'

    test('con la pestaña VISIBLE es un fallo real y cuenta como error', () => {
      expect(esRuidoDeConsola(red)).toBe(false)
      expect(esRuidoDeConsola(red, { leaving: false })).toBe(false)
    })

    test('mientras la página se descarga o está en background, es ruido', () => {
      expect(esRuidoDeConsola(red, { leaving: true })).toBe(true)
    })

    test.each([
      'TypeError: NetworkError when attempting to fetch resource.',
      'Error checking new medals: TypeError: Load failed',
      'AbortError: The operation was aborted',
    ])('otras redacciones del mismo fallo de red: %s', (msg) => {
      expect(esRuidoDeConsola(msg)).toBe(false)
      expect(esRuidoDeConsola(msg, { leaving: true })).toBe(true)
    })
  })

  describe('lo que NUNCA debe silenciarse', () => {
    test.each([
      'Error cargando oposición del usuario: TypeError: undefined is not a function',
      '❌ [answerSaveQueue] respuesta rechazada por el servidor',
      'Cannot read properties of null (reading id)',
    ])('%s sigue siendo error aunque la página se esté yendo', (msg) => {
      expect(esRuidoDeConsola(msg, { leaving: true })).toBe(false)
    })

    test('un mensaje vacío o nulo no revienta ni se marca como ruido', () => {
      expect(esRuidoDeConsola('')).toBe(false)
      expect(esRuidoDeConsola(undefined as unknown as string)).toBe(false)
    })
  })
})
