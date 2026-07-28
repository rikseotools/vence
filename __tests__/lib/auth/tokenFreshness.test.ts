// Unit del núcleo puro de frescura del Bearer (T-210).
// Es la ÚNICA definición de "¿hay que ir a la red a por un token nuevo?" — la usan el
// adapter de Auth.js y el de Supabase. Si estos casos cambian, cambia el comportamiento
// de auth en toda la app, así que están escritos por CASO, no por implementación.

import { isBearerFresh, isBearerExpired, TOKEN_SKEW_SEC } from '@/lib/auth/tokenFreshness'

const NOW = 1_800_000_000_000 // ms
const nowSec = NOW / 1000

describe('isBearerFresh — ¿reusable sin red?', () => {
  test('token con 1 h por delante → fresco', () => {
    expect(isBearerFresh(nowSec + 3600, NOW)).toBe(true)
  })

  test('token justo por encima del margen → fresco', () => {
    expect(isBearerFresh(nowSec + TOKEN_SKEW_SEC + 1, NOW)).toBe(true)
  })

  test('token EXACTAMENTE en el margen → NO fresco (el margen es para renovar antes)', () => {
    expect(isBearerFresh(nowSec + TOKEN_SKEW_SEC, NOW)).toBe(false)
  })

  test('token dentro del margen (le quedan 2 min) → NO fresco', () => {
    expect(isBearerFresh(nowSec + 120, NOW)).toBe(false)
  })

  test('token ya caducado → NO fresco', () => {
    expect(isBearerFresh(nowSec - 10, NOW)).toBe(false)
  })

  // ESTE es el bug de T-210: la ruta del cooldown de 30s devolvía la sesión cacheada
  // sin mirar la expiración → 401 en notificaciones, medallas y guardado de respuestas.
  test('expiración DESCONOCIDA (null) → NO fresco: refresca si puedes', () => {
    expect(isBearerFresh(null, NOW)).toBe(false)
    expect(isBearerFresh(undefined, NOW)).toBe(false)
  })

  test('valores basura no cuelan como frescos', () => {
    expect(isBearerFresh(NaN, NOW)).toBe(false)
    expect(isBearerFresh(Infinity, NOW)).toBe(false)
    expect(isBearerFresh(0, NOW)).toBe(false)
    expect(isBearerFresh(-1, NOW)).toBe(false)
    // @ts-expect-error — el puerto podría entregar un string desde `raw` de un proveedor
    expect(isBearerFresh('1800000000', NOW)).toBe(false)
  })

  test('el margen es configurable (un caller con otro presupuesto)', () => {
    expect(isBearerFresh(nowSec + 60, NOW, 30)).toBe(true)
    expect(isBearerFresh(nowSec + 60, NOW, 120)).toBe(false)
  })

  test('unidades: segundos en expiresAt, milisegundos en now (no confundirlas)', () => {
    // Si alguien pasara `expiresAt` en ms, el resultado sería "fresco" durante siglos:
    // este caso fija que la conversión ×1000 la hace el núcleo, no el caller.
    expect(isBearerFresh(nowSec + 3600, NOW)).toBe(true)
    expect(isBearerFresh(nowSec + 3600, NOW + 3600_000)).toBe(false)
  })
})

describe('isBearerExpired — ¿lo va a rechazar el servidor seguro?', () => {
  test('token con margen por delante → no caducado', () => {
    expect(isBearerExpired(nowSec + 3600, NOW)).toBe(false)
  })

  test('token DENTRO del margen de renovación → todavía NO caducado (sigue siendo válido)', () => {
    expect(isBearerExpired(nowSec + 120, NOW)).toBe(false)
    expect(isBearerFresh(nowSec + 120, NOW)).toBe(false) // pero ya no es "fresco"
  })

  test('token pasado de fecha → caducado', () => {
    expect(isBearerExpired(nowSec - 1, NOW)).toBe(true)
  })

  test('exactamente en el instante de expiración → caducado', () => {
    expect(isBearerExpired(nowSec, NOW)).toBe(true)
  })

  test('expiración desconocida → NO caducado (mejor esfuerzo, ver asimetría del módulo)', () => {
    expect(isBearerExpired(null, NOW)).toBe(false)
    expect(isBearerExpired(undefined, NOW)).toBe(false)
    expect(isBearerExpired(NaN, NOW)).toBe(false)
  })
})

describe('las dos preguntas juntas — invariante', () => {
  test('caducado ⇒ nunca fresco (para cualquier margen)', () => {
    for (const delta of [-10_000, -3600, -1, 0]) {
      const exp = nowSec + delta
      if (isBearerExpired(exp, NOW)) expect(isBearerFresh(exp, NOW)).toBe(false)
    }
  })

  test('fresco ⇒ nunca caducado', () => {
    for (const delta of [TOKEN_SKEW_SEC + 1, 600, 3600, 86_400]) {
      const exp = nowSec + delta
      if (isBearerFresh(exp, NOW)) expect(isBearerExpired(exp, NOW)).toBe(false)
    }
  })
})
