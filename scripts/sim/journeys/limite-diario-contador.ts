// Journey AUTENTICADO (cuenta FREE de prueba): responde N preguntas en un test normal y
// comprueba que el contador del plan gratuito sube EXACTAMENTE lo que se ha respondido.
//
// Nace del caso Sergio (27/07/2026): respondió 15 preguntas y `daily_question_usage`
// marcó 25, dejándolo sin plan gratuito antes de tiempo. Con la observabilidad de
// peticiones muestreada al 10% (withErrorLogging: SUCCESS_TIMING_SAMPLE_RATE) no se
// puede contar las llamadas reales a /api/v2/daily-question/increment, así que la única
// prueba directa es reproducirlo.
//
// Identidad: cuenta FREE dedicada (SIM_FREE_USER_ID). NUNCA un cliente real — responder
// consumiría su cupo diario. Sin esa variable, el journey se salta.
import type { InvariantResult } from '../../../lib/sim/types'
import type { Journey } from '../../../lib/sim/journey'

const USER_ID = process.env.SIM_FREE_USER_ID || ''
const EMAIL = process.env.SIM_FREE_EMAIL || 'sim-limite@vence.es'
const POSITION = 'auxiliar_administrativo_estado'
const A_RESPONDER = Number(process.env.SIM_ANSWERS || 5)

async function leerContador(ctx: any): Promise<number | null> {
  const r = await ctx.api('/api/v2/daily-question/status')
  if (r.status !== 200) return null
  const s = r.json?.status ?? r.json ?? {}
  // La función SQL devuelve el conteo con nombres distintos según versión; se prueban todos.
  for (const k of ['questions_today', 'questionsToday', 'current_count', 'questions_answered']) {
    if (typeof s[k] === 'number') return s[k]
  }
  return null
}

const journey: Journey = {
  name: 'limite-diario-contador',
  severity: 'high',
  as: { userId: USER_ID, email: EMAIL, label: 'free', positionType: POSITION },
  async run(ctx) {
    await ctx.step('abrir test aleatorio', () => ctx.goto(`/${POSITION.replace(/_/g, '-')}/test/aleatorio`), { shot: true })
    await ctx.step('esperar preguntas', () => ctx.page.waitForTimeout(6000))

    const antes = await ctx.step('contador ANTES', () => leerContador(ctx))

    let respondidas = 0
    for (let i = 0; i < A_RESPONDER; i++) {
      const hecho = await ctx.step(`responder pregunta ${i + 1}`, async () => {
        // Botón cuadrado del método rápido: <button>A</button> (TestLayout ~2143).
        const opcion = ctx.page.getByRole('button', { name: /^[ABCD]$/ }).first()
        if (await opcion.count() === 0) return false
        await opcion.click({ timeout: 5000 }).catch(() => {})
        await ctx.page.waitForTimeout(1500)
        const siguiente = ctx.page.getByRole('button', { name: /Siguiente/i }).first()
        if (await siguiente.count()) await siguiente.click({ timeout: 5000 }).catch(() => {})
        await ctx.page.waitForTimeout(1200)
        return true
      })
      if (!hecho) break
      respondidas++
    }

    await ctx.page.waitForTimeout(3000) // dejar drenar la cola de guardado
    const despues = await ctx.step('contador DESPUÉS', () => leerContador(ctx))
    await ctx.screenshot('fin-test')

    const subida = antes != null && despues != null ? despues - antes : null

    return [
      { name: 'contador_legible', ok: antes != null && despues != null, detail: `antes=${antes} despues=${despues}` },
      { name: 'respondio_algo', ok: respondidas > 0, detail: `respondidas=${respondidas}` },
      {
        name: 'contador_sube_lo_respondido',
        ok: subida != null && respondidas > 0 && subida === respondidas,
        detail: `respondidas=${respondidas} subida_contador=${subida}`,
      },
    ] as InvariantResult[]
  },
}
export default journey
