// __tests__/guardrails/canaryCupoVsRespuestasTz.test.ts
//
// GUARDARRAÍL: el canario de cupo (`npm run canary:cupo-vs-respuestas`, T-450) tiene que
// bucketear por día en Europe/Madrid, igual que `increment_daily_questions` (que fija
// `usage_date` con `(NOW() AT TIME ZONE 'Europe/Madrid')::DATE` a propósito: el reset del
// cupo es a medianoche PENINSULAR). Medido el 06/08/2026: comparar contra `created_at::date`
// (UTC en la sesión del cliente pg) reubica 1-2 usuarios/día en agosto (CEST = UTC+2) —
// respuestas de las 22:00-23:59 UTC que el servidor cobra al día de MAÑANA en Madrid, pero
// que el canario seguía contando en el día de HOY. Eso hacía que el canario y el "corte
// directo" no cuadraran, y un canario que no cuadra con la medición directa es peor que no
// tenerlo: no se sabe cuál de los dos manda.
//
// Ancla por lectura de código (sin BD): fija que las DOS comparaciones de fecha del canario
// usan Europe/Madrid, no ::date a secas.

import { readFileSync } from 'fs'
import { join } from 'path'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('GUARDARRAÍL: canario de cupo bucketea por día en Europe/Madrid', () => {
  const src = read('scripts/canary-cupo-vs-respuestas.cjs')

  it('el bucket de respuestas usa Europe/Madrid, no created_at::date a secas', () => {
    expect(src).toMatch(/\(tq\.created_at AT TIME ZONE 'Europe\/Madrid'\)::date AS d/)
  })

  it('la exclusión por periodo de suscripción también compara en Europe/Madrid', () => {
    expect(src).toMatch(/\(tq\.created_at AT TIME ZONE 'Europe\/Madrid'\)::date\s*\n?\s*BETWEEN us\.current_period_start::date/)
  })

  it('el mensaje de ayuda al fallar avisa de filtrar por RESPUESTA real, no por fila', () => {
    // El examen/simulacro pre-crea sus filas en blanco al abrirse; contarlas todas simula
    // una fuga que no existe (mismo error que ya cazó esta ficha el 02/08 para c07c2079).
    expect(src).toMatch(/user_answer/)
  })
})
