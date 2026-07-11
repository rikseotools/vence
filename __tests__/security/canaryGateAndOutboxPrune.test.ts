// __tests__/security/canaryGateAndOutboxPrune.test.ts
// Guardarraíles de dos cabos cerrados el 11/07/2026:
//  1. El gate anti-scraping de /api/questions/filtered debe EXIMIR el tráfico
//     sintético de canaries (header canónico x-vence-canary). Sin esto, el canary
//     `canary-por-leyes-scope` (288 req/día con SMOKE_USER_ID) superaba su cuota y
//     recibía 403 → no podía verificar el scope (12 fallos/hora).
//  2. El outbox `test_questions_outbox` debe PODAR las filas ya procesadas. Sin
//     poda crecían sin techo (514k filas / 1,7 GB desde 2026-05).
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

describe('/api/questions/filtered — el gate anti-scraping exime canaries', () => {
  const route = readFileSync(join(ROOT, 'app/api/questions/filtered/route.ts'), 'utf-8')

  it('importa isSyntheticRequest', () => {
    expect(route).toMatch(/import\s*\{[^}]*isSyntheticRequest[^}]*\}\s*from\s*['"]@\/lib\/api\/syntheticRequest['"]/)
  })

  it('el gate (isCaptchaEnabled) NO se aplica a tráfico sintético', () => {
    expect(route).toMatch(/isCaptchaEnabled\(\)\s*&&\s*!isSyntheticRequest\(request\)/)
  })
})

describe('process-outbox — poda las filas procesadas (anti-bloat)', () => {
  const svc = readFileSync(join(ROOT, 'backend/src/process-outbox/process-outbox.service.ts'), 'utf-8')

  it('borra filas processed_at con retención por antigüedad', () => {
    expect(svc).toMatch(/DELETE FROM test_questions_outbox/)
    expect(svc).toMatch(/processed_at IS NOT NULL/)
    expect(svc).toMatch(/processed_at < now\(\) - interval/)
  })

  it('la poda es acotada (LIMIT) para no bloquear', () => {
    expect(svc).toMatch(/LIMIT \$\{this\.pruneBatch\}/)
  })

  it('la poda se ejecuta en run() y es defensiva (no rompe el procesado)', () => {
    expect(svc).toMatch(/await this\.pruneProcessed\(\)/)
    expect(svc).toMatch(/Poda de outbox falló/)
  })
})

// El ts del evento viene del reloj del CLIENTE en eventos frontend; un navegador
// con reloj roto metió ts=2067 (04/06). Ambos writers de observable_events deben
// clampar el ts a rango sano ([-7d, +1h]) → si no, ensucia queries por hora de evento.
describe('observable_events — clamp del ts del evento (anti reloj-roto)', () => {
  const backendSvc = readFileSync(join(ROOT, 'backend/src/observability/observability.service.ts'), 'utf-8')
  const frontendSink = readFileSync(join(ROOT, 'lib/observability/sink.ts'), 'utf-8')

  for (const [name, s] of [['backend service', backendSvc], ['frontend sink', frontendSink]] as const) {
    it(`${name}: clampa el ts fuera de rango a NOW()`, () => {
      expect(s).toMatch(/CASE WHEN[\s\S]{0,120}BETWEEN NOW\(\) - INTERVAL '7 days' AND NOW\(\) \+ INTERVAL '1 hour'/)
      expect(s).toMatch(/ELSE NOW\(\) END/)
    })
  }
})
