/**
 * La sesión nace sabiendo desde dónde se abrió (T-314, 31/07/2026).
 *
 * ── EL FALLO QUE FIJA ESTE TEST ───────────────────────────────────────────────
 * `user_sessions` se creaba con `ip_address` a NULL y se confiaba en que una SEGUNDA llamada
 * (`/api/auth/track-session-ip`) la rellenara después. Esa llamada llega ANTES de que exista la
 * fila —la fila la crea el arranque de un test, no la carga de la página—, así que el servidor
 * tenía que adivinar a qué sesión pertenecía y elegía «la más reciente sin IP», que era la de otro
 * día. Medido en producción: 96% de las escrituras a sesiones de hace más de 30 min.
 *
 * La regla que no se puede volver a perder: **la IP la escribe quien CREA la fila**, porque es el
 * único que la tiene delante sin adivinar nada. El rescate posterior es un apaño, no la vía.
 *
 * Este test está validado por mutación: quitar `ipAddress` del insert lo pone rojo.
 */

let insertValues: Record<string, unknown> | null = null

const mockReturning = jest.fn(async () => [{ id: 'sesion-1' }])
const mockValues = jest.fn((v: Record<string, unknown>) => {
  insertValues = v
  return { returning: mockReturning }
})
const mockInsert = jest.fn(() => ({ values: mockValues }))

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ insert: mockInsert })),
  getPoolerDb: jest.fn(() => ({ insert: mockInsert })),
}))

jest.mock('@/db/schema', () => ({
  userSessions: { id: 'id' },
}))

import { createUserSession } from '@/lib/api/v2/user-sessions/queries'

const params = { userAgent: 'Mozilla/5.0' }

beforeEach(() => {
  insertValues = null
  jest.clearAllMocks()
})

describe('createUserSession — la fila nace con su origen', () => {
  it('escribe la IP del request que la crea', async () => {
    const r = await createUserSession(params, 'user-1', { ipAddress: '81.32.4.10' })
    expect(r.success).toBe(true)
    expect(insertValues?.ipAddress).toBe('81.32.4.10')
  })

  it('escribe la geo del borde junto a la IP', async () => {
    await createUserSession(params, 'user-1', {
      ipAddress: '81.32.4.10',
      geo: { country_code: 'ES', region: 'M', city: 'Madrid', lat: 40.4, lon: -3.7 },
    })
    expect(insertValues?.countryCode).toBe('ES')
    expect(insertValues?.city).toBe('Madrid')
    // El punto va (lon, lat) — el orden inverso pintaría Madrid en el Atlántico.
    expect(insertValues?.coordinates).toEqual([-3.7, 40.4])
  })

  it('sin geo, la fila se crea igual (dev local no tiene cabeceras del borde)', async () => {
    const r = await createUserSession(params, 'user-1', { ipAddress: '81.32.4.10' })
    expect(r.success).toBe(true)
    expect(insertValues?.countryCode).toBeNull()
    expect(insertValues?.coordinates).toBeNull()
  })

  it('"unknown" NO se escribe: `ip_address` es `inet` y reventaría el INSERT entero', async () => {
    // Es el modo de fallo caro: no se perdería la IP, se perdería la SESIÓN.
    const r = await createUserSession(params, 'user-1', { ipAddress: 'unknown' })
    expect(r.success).toBe(true)
    expect(insertValues?.ipAddress).toBeNull()
  })

  it('sin origen (llamador viejo) la fila sigue creándose, sin IP', async () => {
    const r = await createUserSession(params, 'user-1')
    expect(r.success).toBe(true)
    expect(insertValues?.ipAddress).toBeNull()
  })
})
