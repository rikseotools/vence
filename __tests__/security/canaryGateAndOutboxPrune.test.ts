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

// ⚠️ ACTUALIZADO 30/07/2026 (T-297). Estos dos tests exigían el mecanismo VIEJO —el header
// `x-vence-canary`, sin secreto— y llevaban rojos desde que se endureció el gate el 29/07
// (`cb22c454e`). El endurecimiento es correcto y el test era el desfasado: comprobado contra
// producción, una petición anónima con esa línea recibía las preguntas saltándose el Turnstile.
//
// Antes de reescribirlos se descartó CON DATOS la otra posibilidad, que era la grave: que al
// cerrar el agujero se hubiera dejado a los canaries fuera y alguno hubiera dejado de vigilar en
// silencio. `canary-por-leyes-scope` emite `canary_por_leyes_scope_ok` cada 5 minutos con datos
// reales (`fullMax` 337 / `scopedMax` 122 a las 16:04 del 30/07), así que pasa el gate endurecido.
//
// La intención del guardarraíl no cambia —el canary tiene que poder vigilar— pero ahora incluye la
// mitad que faltaba: **afirmar** ser un canary no puede bastar para saltarse una defensa.
describe('/api/questions/filtered — el gate anti-scraping exime canaries que lo DEMUESTRAN', () => {
  const route = readFileSync(join(ROOT, 'app/api/questions/filtered/route.ts'), 'utf-8')

  it('usa el canary de CONFIANZA (con secreto), no el marcador falsificable', () => {
    expect(route).toMatch(/import\s*\{[^}]*esCanaryDeConfianza[^}]*\}\s*from\s*['"]@\/lib\/api\/syntheticTrust['"]/)
    // [T-381] `secretoCanaryEsperado(process.env)` puede llegar INLINE a `esCanaryDeConfianza`
    // o pasar por una variable (necesaria desde T-381: la reutiliza también
    // `esCanaryParaMetricas`, así que calcularla dos veces sería el propio patrón que este
    // fichero evita en otros sitios). Las dos formas demuestran lo mismo — que el secreto
    // real alimenta la comprobación, no un valor inventado — así que se acepta cualquiera de
    // las dos, capturando el nombre de la variable si la hay.
    const variable = route.match(/const\s+(\w+)\s*=\s*secretoCanaryEsperado\(/)?.[1]
    const usaInline = /esCanaryDeConfianza\(\s*request\s*,\s*secretoCanaryEsperado\(/.test(route)
    const usaVariable =
      !!variable && new RegExp(`esCanaryDeConfianza\\(\\s*request\\s*,\\s*${variable}\\b`).test(route)
    expect(usaInline || usaVariable).toBe(true)
  })

  it('el gate (isCaptchaEnabled) NO se aplica al canary de confianza', () => {
    expect(route).toMatch(/isCaptchaEnabled\(\)\s*&&\s*!canaryDeConfianza/)
  })

  it('REGRESIÓN: el header sin secreto NO exime del gate', () => {
    // El agujero del 29/07 era exactamente esto: `isSyntheticRequest` (header `x-vence-canary`,
    // que cualquiera escribe) decidiendo si se aplica el reto. Si vuelve a aparecer en la condición
    // del gate, el Turnstile se salta escribiendo una línea de cabecera.
    const condicionGate = route.match(/if \(isCaptchaEnabled\(\)[^)]*\)/)?.[0] ?? ''
    expect(condicionGate).not.toMatch(/isSyntheticRequest/)
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
