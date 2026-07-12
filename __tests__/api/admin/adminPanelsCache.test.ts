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
