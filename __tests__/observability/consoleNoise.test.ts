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

// ── Cambio de RUTA (T-210, 28/07/2026) ───────────────────────────────────────────────────────
//
// `leaving` no cubre la navegación de Next: `router.push`/`replace` no dispara `beforeunload` ni
// `pagehide`, y la pestaña sigue visible. Las peticiones de montaje que quedan en vuelo mueren
// igual y se registraban como error completo. El caso puro medido era `/auth/callback` —que
// redirige sola en cuanto tiene sesión— encabezando el ranking con 35 usuarios en 24 h.
describe('ruido por cambio de ruta', () => {
  const { esRuidoDeConsola, VENTANA_NAVEGACION_MS } = require('../../lib/observability/consoleNoise')
  const RED = 'Error cargando notificaciones: TypeError: Failed to fetch'

  it('un fallo de red justo después de navegar es ruido', () => {
    expect(esRuidoDeConsola(RED, { msDesdeNavegacion: 0 })).toBe(true)
    expect(esRuidoDeConsola(RED, { msDesdeNavegacion: 500 })).toBe(true)
  })

  it('pasada la ventana ya NO es ruido: si la red sigue rota, eso es daño real', () => {
    expect(esRuidoDeConsola(RED, { msDesdeNavegacion: VENTANA_NAVEGACION_MS })).toBe(false)
    expect(esRuidoDeConsola(RED, { msDesdeNavegacion: 30000 })).toBe(false)
  })

  it('sin navegación reciente, el fallo de red con la pestaña visible SIGUE contando como error', () => {
    expect(esRuidoDeConsola(RED)).toBe(false)
    expect(esRuidoDeConsola(RED, {})).toBe(false)
    expect(esRuidoDeConsola(RED, { msDesdeNavegacion: undefined })).toBe(false)
  })

  it('la ventana NO indulta a un error que no sea de red: navegar no borra un bug', () => {
    expect(esRuidoDeConsola('TypeError: undefined is not a function', { msDesdeNavegacion: 0 })).toBe(false)
    expect(esRuidoDeConsola('Error guardando la respuesta del usuario', { msDesdeNavegacion: 10 })).toBe(false)
  })

  it('un valor absurdo no abre la puerta (negativo = reloj raro, no indulto)', () => {
    expect(esRuidoDeConsola(RED, { msDesdeNavegacion: -1 })).toBe(false)
  })

  it('`leaving` sigue funcionando por su cuenta (no se ha roto lo que había)', () => {
    expect(esRuidoDeConsola(RED, { leaving: true })).toBe(true)
  })
})

// ── El 401 dejó de ser ruido incondicional (T-210, 28/07/2026) ────────────────────────────────
//
// CAMBIO DELIBERADO, y la evidencia que lo motiva. El 401 vivía junto a GSI/FedCM, así que TODO
// 401 se archivaba en `debug`. Medido: **382 de 383** eventos 401 de 24 h enterrados, y dentro
// estaba «Error cargando perfil: {"status":401}» afectando a **21 usuarios**. Un usuario cuyo
// perfil no carga ha perdido funcionalidad y no puede ni darse cuenta — es el síntoma de [T-245],
// donde alguien intentó pagar 24 veces y quejarse 6, y no pudo hacer ninguna de las dos.
//
// Un 401 mientras te vas o navegas sí es esperable (sesión que cierra, token que se renueva), así
// que se condiciona igual que un fallo de red en vez de silenciarse.
describe('401: esperable al irse, síntoma si ocurre estando en la página', () => {
  const { esRuidoDeConsola } = require('../../lib/observability/consoleNoise')
  const PERFIL = 'Error cargando perfil: {"status":401,"body":"{\"success\":false}"}'
  const NOTIF = 'Error cargando notificaciones: Error: disputes/notifications 401'

  it('con la pestaña visible y sin navegar, un 401 CUENTA como error', () => {
    expect(esRuidoDeConsola(PERFIL)).toBe(false)
    expect(esRuidoDeConsola(NOTIF)).toBe(false)
  })

  it('mientras la página se va, sigue siendo ruido', () => {
    expect(esRuidoDeConsola(PERFIL, { leaving: true })).toBe(true)
  })

  it('y justo después de cambiar de ruta, también', () => {
    expect(esRuidoDeConsola(PERFIL, { msDesdeNavegacion: 300 })).toBe(true)
  })

  it('GSI/FedCM sí siguen siendo ruido pase lo que pase (son de terceros)', () => {
    expect(esRuidoDeConsola('[GSI_LOGGER]: FedCM get() rejects with NetworkError')).toBe(true)
  })
})
