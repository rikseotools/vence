// Guardarraíl (fix 13/07/2026 — CRITICAL falsos recurrentes): un 403 de LÍMITE
// (dispositivos/diario) al guardar respuesta es una respuesta ESPERADA (el usuario
// ve un modal), NO un error. Antes se logueaba como `client_error` → disparaba
// RULE_CLIENT_ERROR_SPIKE (misma clase que el flood de 401). Fix: emitir
// `usage_limit_hit` (info), que la alerta NO cuenta, conservando la visibilidad.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const asq = readFileSync(join(ROOT, 'utils', 'answerSaveQueue.ts'), 'utf-8')
const psq = readFileSync(join(ROOT, 'utils', 'psychometricSaveQueue.ts'), 'utf-8')
const alert = readFileSync(join(ROOT, 'backend', 'src', 'alerts', 'alert-rules.ts'), 'utf-8')
const clientTypes = readFileSync(join(ROOT, 'lib', 'observability', 'client.ts'), 'utf-8')

describe('usage_limit_hit — el 403 de límite no cuenta como error (anti CRITICAL falso)', () => {
  it("'usage_limit_hit' es un ClientEventType válido", () => {
    expect(clientTypes).toMatch(/\|\s*'usage_limit_hit'/)
  })

  it('answerSaveQueue emite usage_limit_hit en el 403 de límite (y distingue el inesperado)', () => {
    expect(asq).toMatch(/eventType:\s*'usage_limit_hit'/)
    expect(asq).toMatch(/isUsageLimit/) // distingue límite de 403 inesperado
    // el 403 inesperado SÍ sigue como error real (no lo enmascaramos)
    expect(asq).toMatch(/403 inesperado/)
  })

  it('psychometricSaveQueue emite usage_limit_hit en el 403 de límite', () => {
    expect(psq).toMatch(/eventType:\s*'usage_limit_hit'/)
    expect(psq).toMatch(/response\.status === 403/)
  })

  it('RULE_CLIENT_ERROR_SPIKE NO cuenta usage_limit_hit', () => {
    // el filtro `event_type IN (...)` de la regla no debe incluir usage_limit_hit
    expect(alert).toMatch(/event_type IN \([^)]*'client_error'[^)]*\)/)
    const inClauses = alert.match(/event_type IN \([^)]*\)/g) || []
    inClauses.forEach(c => expect(c).not.toContain('usage_limit_hit'))
  })
})
