// Guardarraíl (fix 12/07/2026 — contención RDS): los paneles admin de salud
// (system-health) e infraestructura (infra-stats) auto-refrescan cada ~60s por
// admin y agregan sobre observable_events (9,8M filas / 5,4 GB) +
// validation_error_logs. Sin cache eran la query #1 en total_time del primario
// (~60.000 s acumulados, max 112 s) → saturaban el pool RDS → cascada de 503,
// canary db-pool timeout, profile lento y CONNECT_TIMEOUT en build.
//
// Fix: memo in-memory POST-auth (TTL corto) que sirve el payload sin re-escanear.
// Este test verifica POR FUENTE que el memo sigue puesto y — CRÍTICO — que el
// hit de cache ocurre DESPUÉS de la autorización (nunca se sirve dato sin auth).
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..', '..')
const health = readFileSync(join(ROOT, 'app', 'api', 'admin', 'system-health', 'route.ts'), 'utf-8')
const infra = readFileSync(join(ROOT, 'app', 'api', 'admin', 'infra-stats', 'route.ts'), 'utf-8')

describe('system-health — memo in-memory post-auth (anti contención RDS)', () => {
  it('define el cache (get/set) del payload', () => {
    expect(health).toMatch(/function getHealthCache/)
    expect(health).toMatch(/function setHealthCache/)
    expect(health).toMatch(/HEALTH_CACHE_TTL_MS/)
  })

  it('guarda el payload antes de responder', () => {
    expect(health).toMatch(/setHealthCache\(window, _payload\)/)
  })

  it('el hit de cache ocurre DESPUÉS de la comprobación de admin (auth antes que dato)', () => {
    const idxAdminCheck = health.indexOf('isAdmin(auth.email)')
    const idxCacheHit = health.indexOf('const cachedHealth = getHealthCache(window)')
    expect(idxAdminCheck).toBeGreaterThan(-1)
    expect(idxCacheHit).toBeGreaterThan(-1)
    expect(idxCacheHit).toBeGreaterThan(idxAdminCheck)
  })

  it('el TTL es corto (≤60s) — es un panel de salud, no puede quedar rancio', () => {
    const m = health.match(/HEALTH_CACHE_TTL_MS\s*=\s*([\d_]+)/)
    expect(m).toBeTruthy()
    const ttlMs = parseInt(m![1].replace(/_/g, ''), 10)
    expect(ttlMs).toBeGreaterThan(0)
    expect(ttlMs).toBeLessThanOrEqual(60_000)
  })
})

describe('infra-stats — memo in-memory post-auth (anti contención RDS)', () => {
  it('define el cache (get/set) del payload', () => {
    expect(infra).toMatch(/function getInfraCache/)
    expect(infra).toMatch(/function setInfraCache/)
    expect(infra).toMatch(/INFRA_CACHE_TTL_MS/)
  })

  it('guarda el payload antes de responder', () => {
    expect(infra).toMatch(/setInfraCache\(_payload\)/)
  })

  it('el hit de cache ocurre DESPUÉS de la comprobación de admin (auth antes que dato)', () => {
    const idxAdminCheck = infra.indexOf('isAdmin(auth.email)')
    const idxCacheHit = infra.indexOf('const cachedInfra = getInfraCache()')
    expect(idxAdminCheck).toBeGreaterThan(-1)
    expect(idxCacheHit).toBeGreaterThan(-1)
    expect(idxCacheHit).toBeGreaterThan(idxAdminCheck)
  })

  it('el TTL es corto (≤60s)', () => {
    const m = infra.match(/INFRA_CACHE_TTL_MS\s*=\s*([\d_]+)/)
    expect(m).toBeTruthy()
    const ttlMs = parseInt(m![1].replace(/_/g, ''), 10)
    expect(ttlMs).toBeGreaterThan(0)
    expect(ttlMs).toBeLessThanOrEqual(60_000)
  })
})

// Los otros 3 paneles de monitoreo que agregan sobre observable_events y auto-refrescan
// (observability, slos, canary) usan el helper compartido lib/cache/adminPanelMemo. Mismo
// requisito de seguridad: el hit de cache DESPUÉS del gate de auth.
describe.each([
  { name: 'observability', authNeedle: 'requireAdmin(request)' },
  { name: 'slos', authNeedle: 'isAdmin(auth.email)' },
  { name: 'canary', authNeedle: 'isAdmin(auth.email)' },
])('$name — memo compartido post-auth', ({ name, authNeedle }) => {
  const src = readFileSync(join(ROOT, 'app', 'api', 'admin', name, 'route.ts'), 'utf-8')
  it('usa el helper compartido createAdminPanelMemo', () => {
    expect(src).toMatch(/createAdminPanelMemo/)
    expect(src).toMatch(/_memo\.set\(/)
  })
  it('el hit de cache ocurre DESPUÉS del gate de auth', () => {
    const idxAuth = src.indexOf(authNeedle)
    const idxHit = src.indexOf('_memo.get(')
    expect(idxAuth).toBeGreaterThan(-1)
    expect(idxHit).toBeGreaterThan(idxAuth)
  })
})

describe('helper compartido adminPanelMemo — comportamiento real', () => {
  // usa la IMPLEMENTACIÓN real (no una copia) con TTL grande/0 para probar hit/miss
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createAdminPanelMemo } = require('@/lib/cache/adminPanelMemo')
  it('hit dentro del TTL devuelve el mismo objeto; miss (TTL 0) devuelve null', () => {
    const memo = createAdminPanelMemo(60_000)
    expect(memo.get('k')).toBeNull()
    memo.set('k', { v: 1 })
    expect(memo.get('k')).toEqual({ v: 1 })
    const expired = createAdminPanelMemo(0) // TTL 0 → siempre expirado
    expired.set('k', { v: 1 })
    expect(expired.get('k')).toBeNull()
  })
  it('aísla por key', () => {
    const memo = createAdminPanelMemo(60_000)
    memo.set('a', { v: 'a' })
    expect(memo.get('b')).toBeNull()
  })
})

// SIMULACIÓN (capa memoria feedback_feature_multiples_capas_seguridad): réplica mínima
// del memo real (misma forma que system-health) con reloj inyectable, para PROBAR el
// comportamiento: hit dentro del TTL (no re-computa), miss tras expirar, aislamiento por
// key (window), y que un cómputo que lanza NO envenena el cache (no se cachea el fallo).
describe('simulación — comportamiento del memo (TTL + por-key + no cachea fallos)', () => {
  type Entry = { at: number; payload: Record<string, unknown> }
  const makeMemo = (ttlMs: number, clock: () => number) => {
    const store = new Map<string, Entry>()
    let computes = 0
    const get = (k: string) => {
      const e = store.get(k)
      return e && clock() - e.at < ttlMs ? e.payload : null
    }
    const set = (k: string, p: Record<string, unknown>) => store.set(k, { at: clock(), payload: p })
    // simula el flujo del endpoint: si hay hit lo devuelve; si no, computa+guarda
    const serve = (k: string, compute: () => Record<string, unknown>) => {
      const hit = get(k)
      if (hit) return { ...hit, cached: true }
      const p = compute() // si lanza, NO llega a set() → el fallo no se cachea
      set(k, p)
      computes++
      return p
    }
    return { serve, computes: () => computes }
  }

  it('hit dentro del TTL: 2ª llamada NO re-computa y marca cached:true', () => {
    let now = 1000
    const memo = makeMemo(30_000, () => now)
    const a = memo.serve('24h', () => ({ v: 1 }))
    now += 10_000 // dentro de 30s
    const b = memo.serve('24h', () => ({ v: 999 }))
    expect(a).toEqual({ v: 1 })
    expect(b).toEqual({ v: 1, cached: true }) // sirve el memoizado, no el compute nuevo
    expect(memo.computes()).toBe(1) // solo computó 1 vez
  })

  it('miss tras expirar el TTL: re-computa', () => {
    let now = 1000
    const memo = makeMemo(30_000, () => now)
    memo.serve('24h', () => ({ v: 1 }))
    now += 31_000 // pasó el TTL
    const b = memo.serve('24h', () => ({ v: 2 }))
    expect(b).toEqual({ v: 2 })
    expect(memo.computes()).toBe(2)
  })

  it('aislamiento por key (window): 1h y 24h no comparten cache', () => {
    let now = 1000
    const memo = makeMemo(30_000, () => now)
    memo.serve('1h', () => ({ w: '1h' }))
    const b = memo.serve('24h', () => ({ w: '24h' }))
    expect(b).toEqual({ w: '24h' }) // no devuelve el de 1h
    expect(memo.computes()).toBe(2)
  })

  it('un cómputo que lanza NO envenena el cache (siguiente intento re-computa)', () => {
    let now = 1000
    const memo = makeMemo(30_000, () => now)
    expect(() => memo.serve('24h', () => { throw new Error('DB down') })).toThrow('DB down')
    const b = memo.serve('24h', () => ({ ok: true })) // reintento tras recuperación
    expect(b).toEqual({ ok: true })
  })
})
