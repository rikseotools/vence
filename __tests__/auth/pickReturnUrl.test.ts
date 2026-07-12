// Simulación a fondo del flujo de retorno post-login (preocupación: "¿no se
// reenviaba a la URL donde estaba, p.ej. seguir un test?"). Prueba la función
// REAL pickReturnUrl en todas sus ramas: NO se rompió el retorno; solo el
// último recurso sin contexto pasó de Estado → '/'.
import { pickReturnUrl, NEUTRAL_DEFAULT_URL, RETURN_BACKUP_MAX_AGE_MS } from '@/lib/auth/pickReturnUrl'

const NOW = 1_000_000_000_000

describe('pickReturnUrl — prioridad del retorno post-login (anti-regresión del flujo)', () => {
  it('return_to gana: vuelve a donde estaba (seguir un test)', () => {
    const d = pickReturnUrl('/auxiliar-administrativo-valencia/test/tema/13', null, null, NOW)
    expect(d.url).toBe('/auxiliar-administrativo-valencia/test/tema/13')
    expect(d.consumeBackup).toBe(false)
  })

  it('return_to gana AUNQUE haya backup en localStorage', () => {
    const d = pickReturnUrl('/test/articulo?x=1', '/otra-url', String(NOW - 1000), NOW)
    expect(d.url).toBe('/test/articulo?x=1')
    expect(d.consumeBackup).toBe(false)
  })

  it('sin return_to + backup FRESCO (<10min) → usa el backup y lo consume', () => {
    const d = pickReturnUrl(null, '/subalterno-gva/test', String(NOW - 60_000), NOW)
    expect(d.url).toBe('/subalterno-gva/test')
    expect(d.consumeBackup).toBe(true)
  })

  it('sin return_to + backup STALE (>10min) → default neutro y limpia el backup', () => {
    const d = pickReturnUrl(null, '/algo-viejo', String(NOW - (RETURN_BACKUP_MAX_AGE_MS + 1)), NOW)
    expect(d.url).toBe(NEUTRAL_DEFAULT_URL)
    expect(d.consumeBackup).toBe(true)
  })

  it('sin return_to ni backup → default neutro "/" (NO Estado)', () => {
    const d = pickReturnUrl(null, null, null, NOW)
    expect(d.url).toBe('/')
    expect(d.consumeBackup).toBe(false)
    expect(d.url).not.toContain('auxiliar-administrativo-estado')
  })

  it('timestamp corrupto → se trata como stale (no crashea, va a default)', () => {
    const d = pickReturnUrl(null, '/algo', 'no-es-numero', NOW)
    expect(d.url).toBe(NEUTRAL_DEFAULT_URL)
    expect(d.consumeBackup).toBe(true)
  })

  it('el default neutro NUNCA es la oposición flagship (Estado)', () => {
    expect(NEUTRAL_DEFAULT_URL).toBe('/')
    expect(NEUTRAL_DEFAULT_URL).not.toContain('estado')
  })
})
