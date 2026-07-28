// Journey: el panel "Tu Evolución en esta pregunta" NO puede contradecirse a sí mismo.
//
// Bug real (28/07/2026, feedback 108cc2a8 de MariSol, premium de Valencia): respondió una pregunta
// BIEN y la cabecera le dijo «Sigues fallando esta pregunta (0/2)»; en otra FALLÓ y le dijo
// «¡Progreso! Antes fallaste, ahora acertaste». Ella lo reportó como "las bolitas verde/roja salen
// al revés". Se replayearon sus tres casos con datos reales
// (`scripts/sim/sim-evolucion-marisol.ts`): las bolitas y el porcentaje coinciden EXACTAMENTE con
// la base de datos y es la CABECERA la que miente — el fallo está en `currentResult`, que el
// TestLayout deriva del estado del cliente (`selectedAnswer === verifiedCorrectAnswer`), no en la
// función pura que pinta el panel.
//
// Este journey lo caza desde el navegador, que es donde vive: responde varias preguntas eligiendo
// SIEMPRE una opción conocida, y en cada una comprueba que la cabecera no afirma lo contrario de lo
// que la propia UI acaba de marcar como acierto/fallo. Es un invariante de COHERENCIA: no necesita
// saber cuál es la respuesta correcta, solo que las dos verdades del recuadro no se contradigan.
import { evolutionHeaderMatchesLastAttempt } from '../../../lib/sim/invariants'
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

// El repaso de fallos es donde apareció (ahí el guardado gana la carrera SIEMPRE y el panel se
// re-renderiza con el intento ya persistido), pero el panel es el mismo en cualquier test.
const RUTA = process.env.SIM_EVOLUCION_PATH ?? '/test/repaso-fallos-v2'
const PREGUNTAS = Number(process.env.SIM_EVOLUCION_N ?? 6)

// El panel de evolución solo existe para un usuario con historial → journey AUTENTICADO con la
// MISMA cuenta de test que el resto de canaries (SMOKE_USER_ID). NUNCA un cliente real; sin esa
// variable el runner lo salta en vez de fallar.
const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_valencia'

const journey: Journey = {
  name: 'evolucion-cabecera-coherente',
  severity: 'high', // afirma al usuario que ha fallado algo que acertó: mina la confianza en sus datos
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    const resultados: InvariantResult[] = []

    await ctx.step('abrir test', () => ctx.goto(RUTA), { shot: true })
    await ctx.page.waitForTimeout(4000)

    for (let i = 0; i < PREGUNTAS; i++) {
      const respondida = await ctx.step(`responder pregunta ${i + 1}`, async () => {
        const opcion = ctx.page.locator('button', { hasText: /^[A-D][).]?\s/ }).first()
        if (!(await opcion.count())) return false
        await opcion.click()
        await ctx.page.waitForTimeout(2500) // deja aterrizar el guardado asíncrono
        return true
      })
      if (!respondida) break

      // Verdad de la UI para ESE intento: el bloque de resultado dice si fue correcta.
      const acerto = (await ctx.seesText(/¡Correcto!|Respuesta correcta/i)) > 0
      const fallo = (await ctx.seesText(/Incorrecto|Respuesta incorrecta/i)) > 0
      if (!acerto && !fallo) continue // sin veredicto visible, no hay nada que contrastar

      const cabecera = await ctx.page
        .locator('text=/Siempre aciertas|Sigues fallando|ahora acertaste|Antes acertaste|La acertaste/i')
        .first()
        .textContent()
        .catch(() => null)

      if (cabecera) {
        const r = evolutionHeaderMatchesLastAttempt({ headerText: cabecera, lastAttemptCorrect: acerto })
        if (!r.ok) await ctx.screenshot(`cabecera-incoherente-${i + 1}`)
        resultados.push(r)
      }

      await ctx.step(`siguiente ${i + 1}`, async () => {
        const next = ctx.page.getByRole('button', { name: /Siguiente Pregunta/i }).first()
        if (await next.count()) { await next.click(); await ctx.page.waitForTimeout(1800) }
      })
    }

    // Sin datos que contrastar el journey no puede dar verde silencioso: se dice explícitamente.
    if (resultados.length === 0) {
      return [{ name: 'evolution_header_matches_last_attempt', ok: false, detail: 'no se pudo evaluar ninguna pregunta (¿test vacío o selectores cambiados?)' }]
    }
    return resultados
  },
}
export default journey
