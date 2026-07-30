/**
 * Cuándo se registra la IP de la sesión (T-314).
 *
 * El fallo que fija este test: el registro cayó del 80% al 1% el 03/07/2026 y estuvo 27 días roto
 * en silencio, porque el disparador colgaba del evento `SIGNED_IN`. Con Auth.js ese evento casi no
 * llega — su adaptador emula los eventos por polling y quien vuelve con la cookie de 30 días
 * produce `INITIAL_SESSION`. La condición correcta no menciona ningún evento: «hay usuario y hace
 * horas que no registramos su IP».
 */
import {
  shouldTrackSessionIp,
  encodeTrackMark,
  decodeTrackMark,
  TRACK_IP_TTL_HOURS,
} from '@/lib/security/sessionIpTracking'

const AHORA = new Date('2026-07-30T12:00:00Z').getTime()
const horas = (h: number) => h * 3600_000

describe('shouldTrackSessionIp — la decisión NO depende de ningún evento de auth', () => {
  it('sin usuario, no se registra', () => {
    expect(shouldTrackSessionIp({ userId: null, lastTrackedAtMs: null, nowMs: AHORA })).toBe(false)
    expect(shouldTrackSessionIp({ userId: undefined, lastTrackedAtMs: null, nowMs: AHORA })).toBe(false)
    expect(shouldTrackSessionIp({ userId: '', lastTrackedAtMs: null, nowMs: AHORA })).toBe(false)
  })

  it('usuario sin marca previa → se registra (el caso de quien vuelve con la cookie viva)', () => {
    expect(shouldTrackSessionIp({ userId: 'u1', lastTrackedAtMs: null, nowMs: AHORA })).toBe(true)
  })

  it('dentro de la ventana no se repite (una navegación no es una escritura)', () => {
    expect(shouldTrackSessionIp({
      userId: 'u1', lastTrackedAtMs: AHORA - horas(1), lastTrackedUserId: 'u1', nowMs: AHORA,
    })).toBe(false)
  })

  it('pasada la ventana vuelve a registrar', () => {
    expect(shouldTrackSessionIp({
      userId: 'u1', lastTrackedAtMs: AHORA - horas(TRACK_IP_TTL_HOURS + 1), lastTrackedUserId: 'u1', nowMs: AHORA,
    })).toBe(true)
  })

  it('EL CASO QUE MÁS IMPORTA: cambiar de cuenta registra al instante, sin esperar la ventana', () => {
    // Es la firma del farmeo multicuenta: cerrar sesión y entrar con otro correo en el mismo
    // equipo. Si esperásemos a que venciera la ventana, perderíamos justo el dato que buscamos.
    expect(shouldTrackSessionIp({
      userId: 'u2', lastTrackedAtMs: AHORA - horas(0.1), lastTrackedUserId: 'u1', nowMs: AHORA,
    })).toBe(true)
  })

  it('un reloj hacia atrás no deja de registrar para siempre', () => {
    expect(shouldTrackSessionIp({
      userId: 'u1', lastTrackedAtMs: AHORA + horas(48), lastTrackedUserId: 'u1', nowMs: AHORA,
    })).toBe(true)
  })

  it('la ventana es configurable', () => {
    const base = { userId: 'u1', lastTrackedAtMs: AHORA - horas(2), lastTrackedUserId: 'u1', nowMs: AHORA }
    expect(shouldTrackSessionIp({ ...base, ttlHours: 1 })).toBe(true)
    expect(shouldTrackSessionIp({ ...base, ttlHours: 8 })).toBe(false)
  })

  it('frontera exacta de la ventana', () => {
    const justo = { userId: 'u1', lastTrackedUserId: 'u1', nowMs: AHORA }
    expect(shouldTrackSessionIp({ ...justo, lastTrackedAtMs: AHORA - horas(TRACK_IP_TTL_HOURS) })).toBe(true)
    expect(shouldTrackSessionIp({ ...justo, lastTrackedAtMs: AHORA - horas(TRACK_IP_TTL_HOURS) + 1 })).toBe(false)
  })
})

describe('la marca del navegador tolera basura sin dejar de registrar', () => {
  it('ida y vuelta', () => {
    expect(decodeTrackMark(encodeTrackMark('u1', AHORA))).toEqual({ userId: 'u1', atMs: AHORA })
  })

  it.each([null, undefined, '', 'basura', 'u1|', '|123', 'u1|abc', 'u1|-5', 12345 as never])(
    'ante %p devuelve "sin marca" → se registra',
    (raw) => {
      const m = decodeTrackMark(raw as string)
      expect(m.atMs).toBeNull()
      expect(shouldTrackSessionIp({
        userId: 'u1', lastTrackedAtMs: m.atMs, lastTrackedUserId: m.userId, nowMs: AHORA,
      })).toBe(true)
    },
  )
})
