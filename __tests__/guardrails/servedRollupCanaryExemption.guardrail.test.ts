/**
 * T-381 (07/08/2026) — el canario `served-rollup` denunciaba tráfico sintético contabilizado
 * en `daily_questions_served`: un canario que se identifica pero NO demuestra que esté exento
 * del reto (a propósito — `canary-questions-gate`/T-280 está probando justo que el reto no le
 * salta a un usuario normal) se contaba igual como si fuera un opositor. Firma exacta:
 * numQuestions=1, cero respuestas — la que persigue el detector de cosecha.
 *
 * Este guardarraíl mira el CÓDIGO, no la prosa: que `app/api/questions/filtered/route.ts` use
 * DOS criterios DISTINTOS —uno para el reto (estricto, no puede aflojarse) y otro, más laxo a
 * propósito, solo para la contabilización de métricas— y que no se hayan fusionado en uno solo
 * (lo que reabriría este mismo hueco, o endurecería el reto para canarios que necesitan
 * mostrarse como tráfico normal).
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const ROUTE = readFileSync(join(ROOT, 'app/api/questions/filtered/route.ts'), 'utf8')
const CANARY_GATE = readFileSync(
  join(ROOT, 'backend/src/canary-questions-gate/canary-questions-gate.service.ts'),
  'utf8',
)

describe('app/api/questions/filtered/route.ts: dos exenciones DISTINTAS, no una', () => {
  it('importa esCanaryParaMetricas además de esCanaryDeConfianza (no reimplementa el criterio)', () => {
    expect(ROUTE).toMatch(/esCanaryDeConfianza/)
    expect(ROUTE).toMatch(/esCanaryParaMetricas/)
  })

  it('el RETO se decide con canaryDeConfianza (el estricto) — no puede aflojarse por error', () => {
    const iChallenge = ROUTE.indexOf('isCaptchaEnabled() && !canaryDeConfianza')
    expect(iChallenge).toBeGreaterThan(-1)
  })

  it('la contabilización en daily_questions_served se decide con canaryParaMetricas (el laxo), NO con canaryDeConfianza', () => {
    const iRecord = ROUTE.indexOf('recordServedForSubjects(gateSubs, result.questions.length)')
    expect(iRecord).toBeGreaterThan(-1)
    // La condición que envuelve la llamada, mirando hacia atrás desde el propio recordServedForSubjects.
    const antes = ROUTE.slice(Math.max(0, iRecord - 200), iRecord)
    expect(antes).toMatch(/!canaryParaMetricas/)
    expect(antes).not.toMatch(/!canaryDeConfianza/)
  })
})

describe('backend/src/canary-questions-gate: la sonda REAL demuestra ser canario sin demostrar que no haga falta retarla', () => {
  it('la rama sondaReal manda la cabecera de MÉTRICAS, no la de reto', () => {
    const iSonda = CANARY_GATE.indexOf('const exencion: Record<string, string> = sondaReal')
    expect(iSonda).toBeGreaterThan(-1)
    const bloque = CANARY_GATE.slice(iSonda, iSonda + 400)
    expect(bloque).toMatch(/'x-vence-canary-metrics-secret'/)
  })

  it('sigue SIN mandar la cabecera de reto en la rama sondaReal (si la mandara, dejaría de probar el camino real)', () => {
    const iSonda = CANARY_GATE.indexOf('const exencion: Record<string, string> = sondaReal')
    const iElse = CANARY_GATE.indexOf(': {', iSonda)
    const ramaSondaReal = CANARY_GATE.slice(iSonda, iElse)
    expect(ramaSondaReal).not.toMatch(/'x-vence-canary-secret'/)
  })

  it('cita T-381, así que quien lo toque sabe por qué existen las dos cabeceras', () => {
    expect(CANARY_GATE).toContain('T-381')
  })
})
